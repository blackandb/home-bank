-- Home Bank MVP — balance correction and international pending transfers
-- Run after 001_black_finance_mvp.sql on an existing Supabase project.

begin;

alter table public.finance_accounts
  alter column ledger_balance set default 128744.16;

-- Correct only untouched demo accounts created with the previous 130,000 RON seed.
-- Accounts that already have transfers or another balance are not overwritten.
update public.finance_accounts a
set ledger_balance = 128744.16,
    updated_at = now()
where a.currency = 'RON'
  and a.ledger_balance = 130000.00
  and a.reserved_balance = 0
  and not exists (
    select 1
    from public.finance_transactions t
    where t.account_id = a.id
  );

create or replace function public.finance_is_valid_iban(p_iban text)
returns boolean
language plpgsql
immutable
strict
as $$
declare
  normalized text := upper(regexp_replace(p_iban, '[^A-Za-z0-9]', '', 'g'));
  rearranged text;
  current_char text;
  current_value integer;
  remainder_value integer := 0;
  position_index integer;
begin
  if normalized !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'
    or length(normalized) < 15
    or length(normalized) > 34 then
    return false;
  end if;

  rearranged := substr(normalized, 5) || substr(normalized, 1, 4);

  for position_index in 1..length(rearranged) loop
    current_char := substr(rearranged, position_index, 1);
    if current_char ~ '^[0-9]$' then
      current_value := current_char::integer;
      remainder_value := (remainder_value * 10 + current_value) % 97;
    else
      current_value := ascii(current_char) - ascii('A') + 10;
      remainder_value := (remainder_value * 100 + current_value) % 97;
    end if;
  end loop;

  return remainder_value = 1;
end;
$$;

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
  normalized_iban text;
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
    set ledger_balance = ledger_balance - p_amount,
        updated_at = now()
    where id = sender_account.id;

    update public.finance_accounts
    set ledger_balance = ledger_balance + p_amount,
        updated_at = now()
    where id = recipient_account.id;

    insert into public.finance_transfers (
      sender_id, sender_account_id, recipient_id, recipient_account_id,
      recipient_identifier, transfer_type, amount, description, status,
      idempotency_key, completed_at
    )
    values (
      actor, sender_account.id, recipient_profile.user_id, recipient_account.id,
      p_recipient_identifier, 'internal', p_amount,
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
        p_amount, 'debit', 'completed', sender_account.available_balance - p_amount
      ),
      (
        recipient_profile.user_id, recipient_account.id, transfer_id,
        'Transfer de la ' || sender_profile.full_name,
        coalesce(nullif(trim(p_description), ''), 'Transfer intern Home Bank'),
        p_amount, 'credit', 'completed', recipient_account.available_balance + p_amount
      );
  else
    normalized_iban := upper(regexp_replace(coalesce(p_recipient_iban, ''), '[^A-Za-z0-9]', '', 'g'));
    if not public.finance_is_valid_iban(normalized_iban) then
      raise exception 'A valid international IBAN is required';
    end if;

    -- Pending external transfers reserve the amount. This immediately lowers
    -- available_balance while keeping the ledger auditable until settlement.
    update public.finance_accounts
    set reserved_balance = reserved_balance + p_amount,
        updated_at = now()
    where id = sender_account.id;

    insert into public.finance_transfers (
      sender_id, sender_account_id, recipient_iban, transfer_type, amount,
      description, status, idempotency_key
    )
    values (
      actor, sender_account.id, normalized_iban, 'external_iban', p_amount,
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
      'Transfer IBAN ' || right(normalized_iban, 6),
      coalesce(nullif(trim(p_description), ''), 'Transfer extern în așteptare'),
      p_amount, 'debit', 'pending', sender_account.available_balance - p_amount
    );
  end if;

  return transfer_id;
end;
$$;

revoke all on function public.finance_is_valid_iban(text) from public;
grant execute on function public.finance_is_valid_iban(text) to authenticated;

revoke all on function public.finance_create_transfer(
  text, text, text, numeric, text, uuid
) from public;
grant execute on function public.finance_create_transfer(
  text, text, text, numeric, text, uuid
) to authenticated;

commit;
