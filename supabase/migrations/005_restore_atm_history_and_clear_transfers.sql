-- Home Bank — restore the requested account history and clear test transfers
-- Run once after 004_remove_latest_test_payment_and_reset.sql.
-- Safe to run again: the migration marker prevents repeated changes.

begin;

create table if not exists public.finance_data_migrations (
  migration_key text primary key,
  applied_at timestamptz not null default now()
);

alter table public.finance_data_migrations enable row level security;

do $$
declare
  target_user_id uuid;
  target_account_id uuid;
begin
  if exists (
    select 1
    from public.finance_data_migrations
    where migration_key = '20260727_home_bank_restore_atm_history_v1'
  ) then
    return;
  end if;

  select id
  into target_user_id
  from auth.users
  where lower(email) = lower('xeurxeur1@gmail.com')
  limit 1;

  if target_user_id is null then
    raise exception
      'Create xeurxeur1@gmail.com in Supabase Authentication > Users before running this migration.';
  end if;

  select id
  into target_account_id
  from public.finance_accounts
  where owner_id = target_user_id
    and currency = 'RON'
  limit 1;

  if target_account_id is null then
    raise exception
      'No RON finance account exists for xeurxeur1@gmail.com.';
  end if;

  -- Remove every test transfer sent by this user, including its ledger rows.
  delete from public.finance_transactions
  where transfer_id in (
    select id
    from public.finance_transfers
    where sender_id = target_user_id
  );

  delete from public.finance_transfers
  where sender_id = target_user_id;

  -- Remove the last 100 RON test payment and any previous copies of the
  -- requested ATM/OMV history before inserting the canonical movements.
  delete from public.finance_transactions
  where owner_id = target_user_id
    and (
      (direction = 'debit' and amount = 100.00)
      or upper(title) like 'ATM BUCUREȘTI VICTORIEI%'
      or upper(title) like 'OMV BRAȘOV%'
      or upper(title) like 'OMV BRASOV%'
    );

  update public.finance_accounts
  set ledger_balance = 128744.16,
      reserved_balance = 0,
      updated_at = now()
  where id = target_account_id;

  insert into public.finance_transactions (
    owner_id,
    account_id,
    title,
    description,
    amount,
    direction,
    status,
    balance_after,
    created_at
  )
  values
    (
      target_user_id, target_account_id, 'OMV BRAȘOV', 'Achiziție card',
      119.68, 'debit', 'completed', 128744.16,
      '2026-07-27 11:25:00+03'::timestamptz
    ),
    (
      target_user_id, target_account_id, 'ATM BUCUREȘTI VICTORIEI',
      'Depunere numerar · ATM', 4950.00, 'credit', 'completed', 128744.16,
      '2026-07-25 18:03:00+03'::timestamptz
    ),
    (
      target_user_id, target_account_id, 'ATM BUCUREȘTI VICTORIEI',
      'Depunere numerar · ATM', 4950.00, 'credit', 'completed', 128744.16,
      '2026-07-25 17:31:00+03'::timestamptz
    ),
    (
      target_user_id, target_account_id, 'ATM BUCUREȘTI VICTORIEI',
      'Depunere numerar · ATM', 4950.00, 'credit', 'completed', 128744.16,
      '2026-07-25 16:58:00+03'::timestamptz
    ),
    (
      target_user_id, target_account_id, 'ATM BUCUREȘTI VICTORIEI',
      'Depunere numerar · ATM', 4950.00, 'credit', 'completed', 128744.16,
      '2026-07-25 16:20:00+03'::timestamptz
    ),
    (
      target_user_id, target_account_id, 'ATM BUCUREȘTI VICTORIEI',
      'Depunere numerar · ATM', 4950.00, 'credit', 'completed', 128744.16,
      '2026-07-25 15:42:00+03'::timestamptz
    ),
    (
      target_user_id, target_account_id, 'ATM BUCUREȘTI VICTORIEI',
      'Depunere numerar · ATM', 4950.00, 'credit', 'completed', 128744.16,
      '2026-07-25 15:01:00+03'::timestamptz
    );

  insert into public.finance_data_migrations (migration_key)
  values ('20260727_home_bank_restore_atm_history_v1');
end;
$$;

commit;
