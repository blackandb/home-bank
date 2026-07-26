-- BLACK& Finance MVP
-- Run once in Supabase SQL Editor on a new project.
-- This is an application ledger, not a connection to a real banking rail.

create extension if not exists pgcrypto;

create table if not exists public.finance_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique
    check (username = lower(username) and username ~ '^[a-z0-9._-]{3,64}$'),
  login_email text not null unique,
  full_name text not null default 'Client BLACK&',
  phone text,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.finance_profiles(user_id) on delete cascade,
  account_name text not null default 'Cont Curent',
  iban text not null unique,
  currency text not null default 'RON' check (currency = 'RON'),
  ledger_balance numeric(18,2) not null default 128744.16
    check (ledger_balance >= 0),
  reserved_balance numeric(18,2) not null default 0
    check (reserved_balance >= 0),
  available_balance numeric(18,2)
    generated always as (ledger_balance - reserved_balance) stored,
  status text not null default 'active'
    check (status in ('active', 'frozen', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, currency)
);

create table if not exists public.finance_transfers (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.finance_profiles(user_id),
  sender_account_id uuid not null references public.finance_accounts(id),
  recipient_id uuid references public.finance_profiles(user_id),
  recipient_account_id uuid references public.finance_accounts(id),
  recipient_identifier text,
  recipient_iban text,
  transfer_type text not null
    check (transfer_type in ('internal', 'external_iban')),
  amount numeric(18,2) not null check (amount > 0),
  currency text not null default 'RON' check (currency = 'RON'),
  description text not null default 'Transfer BLACK&',
  status text not null
    check (status in ('completed', 'pending', 'rejected', 'cancelled')),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (sender_id, idempotency_key)
);

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.finance_profiles(user_id) on delete cascade,
  account_id uuid not null references public.finance_accounts(id) on delete cascade,
  transfer_id uuid references public.finance_transfers(id) on delete set null,
  title text not null,
  description text,
  amount numeric(18,2) not null check (amount > 0),
  direction text not null check (direction in ('credit', 'debit')),
  status text not null check (status in ('completed', 'pending', 'reversed')),
  balance_after numeric(18,2) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.finance_profiles(user_id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  device_name text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists finance_transactions_owner_created_idx
  on public.finance_transactions(owner_id, created_at desc);
create index if not exists finance_transfers_sender_created_idx
  on public.finance_transfers(sender_id, created_at desc);
create index if not exists finance_transfers_recipient_created_idx
  on public.finance_transfers(recipient_id, created_at desc);

create or replace function public.finance_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists finance_profiles_touch on public.finance_profiles;
create trigger finance_profiles_touch
before update on public.finance_profiles
for each row execute function public.finance_touch_updated_at();

drop trigger if exists finance_accounts_touch on public.finance_accounts;
create trigger finance_accounts_touch
before update on public.finance_accounts
for each row execute function public.finance_touch_updated_at();

create or replace function public.finance_make_demo_iban(p_user_id uuid)
returns text
language sql
immutable
strict
as $$
  select 'RO36BLACK' || upper(substr(replace(p_user_id::text, '-', ''), 1, 16));
$$;

create or replace function public.finance_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  base_username text;
  safe_username text;
begin
  base_username := lower(
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      split_part(coalesce(new.email, 'client'), '@', 1)
    )
  );
  base_username := regexp_replace(base_username, '[^a-z0-9._-]', '', 'g');
  if length(base_username) < 3 then
    base_username := 'client';
  end if;
  safe_username := left(base_username, 52) || '-' || substr(replace(new.id::text, '-', ''), 1, 8);

  insert into public.finance_profiles (
    user_id,
    username,
    login_email,
    full_name
  )
  values (
    new.id,
    safe_username,
    lower(coalesce(new.email, safe_username || '@login.blackandi.internal')),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      'Client BLACK&'
    )
  )
  on conflict (user_id) do nothing;

  insert into public.finance_accounts (
    owner_id,
    account_name,
    iban,
    currency,
    ledger_balance
  )
  values (
    new.id,
    'Cont Curent',
    public.finance_make_demo_iban(new.id),
    'RON',
    128744.16
  )
  on conflict (owner_id, currency) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_finance on auth.users;
create trigger on_auth_user_created_finance
after insert on auth.users
for each row execute function public.finance_handle_new_user();

-- Backfill users created before this migration.
insert into public.finance_profiles (user_id, username, login_email, full_name)
select
  u.id,
  left(
    regexp_replace(lower(split_part(coalesce(u.email, 'client'), '@', 1)), '[^a-z0-9._-]', '', 'g'),
    52
  ) || '-' || substr(replace(u.id::text, '-', ''), 1, 8),
  lower(coalesce(u.email, 'client-' || substr(replace(u.id::text, '-', ''), 1, 8) || '@login.blackandi.internal')),
  coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), 'Client BLACK&')
from auth.users u
on conflict (user_id) do nothing;

insert into public.finance_accounts (owner_id, account_name, iban, currency, ledger_balance)
select
  p.user_id,
  'Cont Curent',
  public.finance_make_demo_iban(p.user_id),
  'RON',
  128744.16
from public.finance_profiles p
on conflict (owner_id, currency) do nothing;

alter table public.finance_profiles enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.finance_transfers enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_passkeys enable row level security;

drop policy if exists "finance_profiles_read_self" on public.finance_profiles;
create policy "finance_profiles_read_self"
on public.finance_profiles for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "finance_profiles_update_self" on public.finance_profiles;
create policy "finance_profiles_update_self"
on public.finance_profiles for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "finance_accounts_read_self" on public.finance_accounts;
create policy "finance_accounts_read_self"
on public.finance_accounts for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "finance_transfers_read_related" on public.finance_transfers;
create policy "finance_transfers_read_related"
on public.finance_transfers for select
to authenticated
using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "finance_transactions_read_self" on public.finance_transactions;
create policy "finance_transactions_read_self"
on public.finance_transactions for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "finance_passkeys_self" on public.finance_passkeys;
create policy "finance_passkeys_self"
on public.finance_passkeys for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.finance_create_transfer(
  p_transfer_type text,
  p_recipient_identifier text,
  p_recipient_iban text,
  p_amount numeric,
  p_description text,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor uuid := auth.uid();
  sender_profile public.finance_profiles%rowtype;
  sender_account public.finance_accounts%rowtype;
  recipient_profile public.finance_profiles%rowtype;
  recipient_account public.finance_accounts%rowtype;
  transfer_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;
  if p_transfer_type not in ('internal', 'external_iban') then
    raise exception 'Unsupported transfer type';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;
  if p_amount > 1000000 then
    raise exception 'MVP transfer limit exceeded';
  end if;

  select * into sender_profile
  from public.finance_profiles
  where user_id = actor and status = 'active';
  if not found then
    raise exception 'Active finance profile required';
  end if;

  select * into sender_account
  from public.finance_accounts
  where owner_id = actor and currency = 'RON' and status = 'active'
  for update;
  if not found then
    raise exception 'Active RON account required';
  end if;

  select id into transfer_id
  from public.finance_transfers
  where sender_id = actor and idempotency_key = p_idempotency_key;
  if found then
    return transfer_id;
  end if;

  if sender_account.available_balance < p_amount then
    raise exception 'Insufficient available balance';
  end if;

  if p_transfer_type = 'internal' then
    select * into recipient_profile
    from public.finance_profiles
    where status = 'active'
      and (
        username = lower(trim(p_recipient_identifier))
        or login_email = lower(trim(p_recipient_identifier))
      )
      and user_id <> actor;
    if not found then
      raise exception 'Recipient not found';
    end if;

    select * into recipient_account
    from public.finance_accounts
    where owner_id = recipient_profile.user_id
      and currency = 'RON'
      and status = 'active'
    for update;
    if not found then
      raise exception 'Recipient account unavailable';
    end if;

    update public.finance_accounts
    set ledger_balance = ledger_balance - p_amount
    where id = sender_account.id;

    update public.finance_accounts
    set ledger_balance = ledger_balance + p_amount
    where id = recipient_account.id;

    insert into public.finance_transfers (
      sender_id, sender_account_id, recipient_id, recipient_account_id,
      recipient_identifier, transfer_type, amount, description, status,
      idempotency_key, completed_at
    )
    values (
      actor, sender_account.id, recipient_profile.user_id, recipient_account.id,
      p_recipient_identifier, 'internal', p_amount,
      coalesce(nullif(trim(p_description), ''), 'Transfer BLACK&'),
      'completed', p_idempotency_key, now()
    )
    returning id into transfer_id;

    insert into public.finance_transactions (
      owner_id, account_id, transfer_id, title, description, amount,
      direction, status, balance_after
    )
    values
      (
        actor, sender_account.id, transfer_id,
        'Transfer către ' || recipient_profile.full_name,
        coalesce(nullif(trim(p_description), ''), 'Transfer intern BLACK&'),
        p_amount, 'debit', 'completed', sender_account.available_balance - p_amount
      ),
      (
        recipient_profile.user_id, recipient_account.id, transfer_id,
        'Transfer de la ' || sender_profile.full_name,
        coalesce(nullif(trim(p_description), ''), 'Transfer intern BLACK&'),
        p_amount, 'credit', 'completed', recipient_account.available_balance + p_amount
      );
  else
    if p_recipient_iban is null
      or upper(regexp_replace(p_recipient_iban, '[^A-Za-z0-9]', '', 'g'))
        !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' then
      raise exception 'A valid international IBAN is required';
    end if;

    update public.finance_accounts
    set reserved_balance = reserved_balance + p_amount
    where id = sender_account.id;

    insert into public.finance_transfers (
      sender_id, sender_account_id, recipient_iban, transfer_type, amount,
      description, status, idempotency_key
    )
    values (
      actor, sender_account.id, upper(replace(p_recipient_iban, ' ', '')),
      'external_iban', p_amount,
      coalesce(nullif(trim(p_description), ''), 'Transfer IBAN'),
      'pending', p_idempotency_key
    )
    returning id into transfer_id;

    insert into public.finance_transactions (
      owner_id, account_id, transfer_id, title, description, amount,
      direction, status, balance_after
    )
    values (
      actor, sender_account.id, transfer_id,
      'Transfer IBAN ' || right(upper(replace(p_recipient_iban, ' ', '')), 6),
      coalesce(nullif(trim(p_description), ''), 'Transfer extern în așteptare'),
      p_amount, 'debit', 'pending', sender_account.available_balance - p_amount
    );
  end if;

  return transfer_id;
end;
$$;

revoke all on function public.finance_create_transfer(
  text, text, text, numeric, text, uuid
) from public;
grant execute on function public.finance_create_transfer(
  text, text, text, numeric, text, uuid
) to authenticated;

grant select, update on public.finance_profiles to authenticated;
grant select on public.finance_accounts to authenticated;
grant select on public.finance_transfers to authenticated;
grant select on public.finance_transactions to authenticated;
grant select, insert, update, delete on public.finance_passkeys to authenticated;
