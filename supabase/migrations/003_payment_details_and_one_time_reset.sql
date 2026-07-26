-- Home Bank MVP — payment details and one-time demo reset
-- Run once after 001 and 002.
-- The marker prevents the balance/test-data reset from running a second time.

begin;

create table if not exists public.finance_data_migrations (
  migration_key text primary key,
  applied_at timestamptz not null default now()
);

alter table public.finance_data_migrations enable row level security;

alter table public.finance_transfers
  add column if not exists recipient_name text;

do $$
declare
  target_user_id uuid;
  test_transfer_ids uuid[];
begin
  if exists (
    select 1
    from public.finance_data_migrations
    where migration_key = '20260726_home_bank_balance_and_test_transfer_reset'
  ) then
    return;
  end if;

  select id
  into target_user_id
  from auth.users
  where lower(email) = lower('xeurxeur1@gmail.com')
  limit 1;

  if target_user_id is not null then
    select array_agg(recent_transfer.id)
    into test_transfer_ids
    from (
      select id
      from public.finance_transfers
      where sender_id = target_user_id
        and transfer_type = 'external_iban'
        and status = 'pending'
      order by created_at desc
      limit 2
    ) as recent_transfer;

    if test_transfer_ids is not null then
      delete from public.finance_transactions
      where transfer_id = any(test_transfer_ids);

      delete from public.finance_transfers
      where id = any(test_transfer_ids);
    end if;

    update public.finance_accounts
    set ledger_balance = 128744.16,
        reserved_balance = 0,
        updated_at = now()
    where owner_id = target_user_id
      and currency = 'RON';

    update public.finance_profiles
    set full_name = 'Constantin Catalin',
        updated_at = now()
    where user_id = target_user_id;
  end if;

  insert into public.finance_data_migrations (migration_key)
  values ('20260726_home_bank_balance_and_test_transfer_reset');
end;
$$;

drop function if exists public.finance_create_transfer(
  text, text, text, numeric, text, uuid
);

create or replace function public.finance_create_transfer(
  p_transfer_type text,
  p_recipient_identifier text,
  p_recipient_iban text,
  p_recipient_name text,
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
  normalized_iban text;
  transfer_id uuid;
  safe_recipient_name text := nullif(trim(p_recipient_name), '');
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
  if safe_recipient_name is null then
    raise exception 'Recipient name is required';
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
    set ledger_balance = ledger_balance - p_amount,
        updated_at = now()
    where id = sender_account.id;

    update public.finance_accounts
    set ledger_balance = ledger_balance + p_amount,
        updated_at = now()
    where id = recipient_account.id;

    insert into public.finance_transfers (
      sender_id, sender_account_id, recipient_id, recipient_account_id,
      recipient_identifier, recipient_name, transfer_type, amount,
      description, status, idempotency_key, completed_at
    )
    values (
      actor, sender_account.id, recipient_profile.user_id, recipient_account.id,
      p_recipient_identifier, recipient_profile.full_name, 'internal', p_amount,
      coalesce(nullif(trim(p_description), ''), 'Transfer Home Bank'),
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
        coalesce(nullif(trim(p_description), ''), 'Transfer intern Home Bank'),
        p_amount, 'debit', 'completed',
        sender_account.available_balance - p_amount
      ),
      (
        recipient_profile.user_id, recipient_account.id, transfer_id,
        'Transfer de la ' || sender_profile.full_name,
        coalesce(nullif(trim(p_description), ''), 'Transfer intern Home Bank'),
        p_amount, 'credit', 'completed',
        recipient_account.available_balance + p_amount
      );
  else
    normalized_iban := upper(
      regexp_replace(coalesce(p_recipient_iban, ''), '[^A-Za-z0-9]', '', 'g')
    );
    if not public.finance_is_valid_iban(normalized_iban) then
      raise exception 'A valid IBAN is required';
    end if;

    -- Pending IBAN transfers reserve the amount immediately. Because the UI
    -- reads available_balance, every new transfer lowers the displayed balance
    -- while the ledger remains auditable until settlement.
    update public.finance_accounts
    set reserved_balance = reserved_balance + p_amount,
        updated_at = now()
    where id = sender_account.id;

    insert into public.finance_transfers (
      sender_id, sender_account_id, recipient_iban, recipient_name,
      transfer_type, amount, description, status, idempotency_key
    )
    values (
      actor, sender_account.id, normalized_iban, safe_recipient_name,
      'external_iban', p_amount,
      coalesce(nullif(trim(p_description), ''), 'Transfer Home Bank'),
      'pending', p_idempotency_key
    )
    returning id into transfer_id;

    insert into public.finance_transactions (
      owner_id, account_id, transfer_id, title, description, amount,
      direction, status, balance_after
    )
    values (
      actor, sender_account.id, transfer_id,
      'Transfer către ' || safe_recipient_name,
      coalesce(nullif(trim(p_description), ''), 'Plată în curs de procesare'),
      p_amount, 'debit', 'pending',
      sender_account.available_balance - p_amount
    );
  end if;

  return transfer_id;
end;
$$;

revoke all on function public.finance_create_transfer(
  text, text, text, text, numeric, text, uuid
) from public;
grant execute on function public.finance_create_transfer(
  text, text, text, text, numeric, text, uuid
) to authenticated;

commit;
