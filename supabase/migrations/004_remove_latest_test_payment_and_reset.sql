-- Home Bank MVP — remove the latest test payment and reset the RON balance
-- Run once after 003_payment_details_and_one_time_reset.sql.
-- Safe to run again: the marker prevents a second reset or deletion.

begin;

create table if not exists public.finance_data_migrations (
  migration_key text primary key,
  applied_at timestamptz not null default now()
);

alter table public.finance_data_migrations enable row level security;

do $$
declare
  target_user_id uuid;
  latest_test_transfer_id uuid;
begin
  if exists (
    select 1
    from public.finance_data_migrations
    where migration_key = '20260726_home_bank_remove_latest_test_payment_v2'
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
  into latest_test_transfer_id
  from public.finance_transfers
  where sender_id = target_user_id
    and transfer_type = 'external_iban'
    and status = 'pending'
  order by created_at desc
  limit 1;

  if latest_test_transfer_id is not null then
    delete from public.finance_transactions
    where transfer_id = latest_test_transfer_id;

    delete from public.finance_transfers
    where id = latest_test_transfer_id;
  end if;

  update public.finance_accounts
  set ledger_balance = 128744.16,
      reserved_balance = 0,
      updated_at = now()
  where owner_id = target_user_id
    and currency = 'RON';

  insert into public.finance_data_migrations (migration_key)
  values ('20260726_home_bank_remove_latest_test_payment_v2');
end;
$$;

commit;
