-- Phase 1.5: database security hardening and business isolation via RLS

create or replace function public.is_authorized_for_business(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = p_business_id
      and bm.user_id = auth.uid()
  );
$$;

create or replace function public.is_business_owner_or_admin(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = p_business_id
      and bm.user_id = auth.uid()
      and bm.role in ('OWNER', 'ADMIN')
  );
$$;

create or replace function public.manage_business_membership(
  p_business_id uuid,
  p_target_user_id uuid,
  p_target_role public.membership_role_enum
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role public.membership_role_enum;
begin
  if auth.uid() is null or p_business_id is null or p_target_user_id is null or p_target_role is null then
    raise exception 'Authenticated membership details are required.';
  end if;

  if p_target_user_id = auth.uid() then
    raise exception 'Users cannot manage their own membership.';
  end if;

  select bm.role into v_actor_role
  from public.business_members bm
  where bm.business_id = p_business_id
    and bm.user_id = auth.uid();

  if not found or v_actor_role not in ('OWNER', 'ADMIN') then
    raise exception 'Business owner or admin membership required.';
  end if;

  if v_actor_role = 'ADMIN' and p_target_role not in ('ACCOUNTANT', 'STAFF', 'VIEWER') then
    raise exception 'Admins cannot grant owner or admin roles.';
  end if;

  insert into public.business_members (business_id, user_id, role)
  values (p_business_id, p_target_user_id, p_target_role)
  on conflict (business_id, user_id)
  do update set role = excluded.role;
end;
$$;

create or replace function public.create_business_with_owner(
  p_name text,
  p_registration_no text default null,
  p_address text default null,
  p_phone text default null,
  p_email text default null,
  p_base_currency text default 'MYR',
  p_fiscal_year_start text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authenticated user required to create a business.';
  end if;

  if not exists (select 1 from public.users u where u.id = v_user_id) then
    raise exception 'Authenticated user profile required to create a business.';
  end if;

  insert into public.businesses (
    name, registration_no, address, phone, email, base_currency, fiscal_year_start
  ) values (
    p_name, p_registration_no, p_address, p_phone, p_email, p_base_currency, p_fiscal_year_start
  )
  returning id into v_business_id;

  insert into public.business_members (business_id, user_id, role)
  values (v_business_id, v_user_id, 'OWNER');

  return v_business_id;
end;
$$;

revoke all on function public.is_authorized_for_business(uuid) from public;
revoke all on function public.is_business_owner_or_admin(uuid) from public;
revoke all on function public.manage_business_membership(uuid, uuid, public.membership_role_enum) from public;
revoke all on function public.create_business_with_owner(text, text, text, text, text, text, text) from public;
grant execute on function public.is_authorized_for_business(uuid) to authenticated;
grant execute on function public.is_business_owner_or_admin(uuid) to authenticated;
grant execute on function public.manage_business_membership(uuid, uuid, public.membership_role_enum) to authenticated;
grant execute on function public.create_business_with_owner(text, text, text, text, text, text, text) to authenticated;

alter table public.users enable row level security;
create policy "Users can read own profile"
on public.users
for select
using (auth.uid() = id);

create policy "Users can update own profile"
on public.users
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users cannot delete profile"
on public.users
for delete
using (false);

alter table public.businesses enable row level security;
create policy "Business members can view business"
on public.businesses
for select
using (public.is_authorized_for_business(id));

create policy "Business owners/admins can update business"
on public.businesses
for update
using (public.is_business_owner_or_admin(id))
with check (public.is_business_owner_or_admin(id));

create policy "Business records are not deleted"
on public.businesses
for delete
using (false);

alter table public.business_members enable row level security;
create policy "Members can view memberships for authorized businesses"
on public.business_members
for select
using (
  auth.uid() = user_id
  or public.is_authorized_for_business(business_id)
);

create policy "Membership inserts require authorized RPC"
on public.business_members
for insert
with check (false);

create policy "Membership updates require authorized RPC"
on public.business_members
for update
using (false)
with check (false);

create policy "Membership records are not deleted"
on public.business_members
for delete
using (false);

alter table public.subscriptions enable row level security;
create policy "Authorized users can read subscriptions"
on public.subscriptions
for select
using (public.is_authorized_for_business(business_id));

create policy "Owner/admin can manage subscriptions"
on public.subscriptions
for insert
with check (public.is_business_owner_or_admin(business_id));

create policy "Owner/admin can update subscriptions"
on public.subscriptions
for update
using (public.is_business_owner_or_admin(business_id))
with check (public.is_business_owner_or_admin(business_id));

create policy "Subscriptions are not deleted"
on public.subscriptions
for delete
using (false);

alter table public.financial_accounts enable row level security;
create policy "Business members can read financial accounts"
on public.financial_accounts
for select
using (public.is_authorized_for_business(business_id));

create policy "Business owners/admins can manage financial accounts"
on public.financial_accounts
for insert
with check (public.is_business_owner_or_admin(business_id));

create policy "Business owners/admins can update financial accounts"
on public.financial_accounts
for update
using (public.is_business_owner_or_admin(business_id))
with check (public.is_business_owner_or_admin(business_id));

create policy "Financial accounts are not deleted"
on public.financial_accounts
for delete
using (false);

alter table public.accounts enable row level security;
create policy "Business members can read chart of accounts"
on public.accounts
for select
using (public.is_authorized_for_business(business_id));

create policy "Business owners/admins can create chart of accounts"
on public.accounts
for insert
with check (public.is_business_owner_or_admin(business_id));

create policy "Business owners/admins can update chart of accounts"
on public.accounts
for update
using (public.is_business_owner_or_admin(business_id))
with check (public.is_business_owner_or_admin(business_id));

create policy "Accounts are not deleted"
on public.accounts
for delete
using (false);

alter table public.transactions enable row level security;
create policy "Business members can read transactions"
on public.transactions
for select
using (public.is_authorized_for_business(business_id));

create policy "Authorized members can create transactions"
on public.transactions
for insert
with check (public.is_authorized_for_business(business_id));

create policy "Authorized members can update transactions"
on public.transactions
for update
using (public.is_authorized_for_business(business_id))
with check (public.is_authorized_for_business(business_id));

create policy "Transactions are not deleted"
on public.transactions
for delete
using (false);

alter table public.journal_entries enable row level security;
create policy "Business members can read journal entries"
on public.journal_entries
for select
using (public.is_authorized_for_business(business_id));

create policy "Authorized members can create journal entries"
on public.journal_entries
for insert
with check (public.is_authorized_for_business(business_id));

create policy "Authorized members can update journal entries"
on public.journal_entries
for update
using (public.is_authorized_for_business(business_id))
with check (public.is_authorized_for_business(business_id));

create policy "Journal entries are not deleted"
on public.journal_entries
for delete
using (false);

alter table public.journal_lines enable row level security;
create policy "Business members can read journal lines"
on public.journal_lines
for select
using (
  exists (
    select 1
    from public.journal_entries je
    where je.id = journal_lines.journal_entry_id
      and public.is_authorized_for_business(je.business_id)
  )
);

create policy "Authorized members can create journal lines"
on public.journal_lines
for insert
with check (
  exists (
    select 1
    from public.journal_entries je
    where je.id = journal_lines.journal_entry_id
      and public.is_authorized_for_business(je.business_id)
  )
);

create policy "Authorized members can update journal lines"
on public.journal_lines
for update
using (
  exists (
    select 1
    from public.journal_entries je
    where je.id = journal_lines.journal_entry_id
      and public.is_authorized_for_business(je.business_id)
  )
)
with check (
  exists (
    select 1
    from public.journal_entries je
    where je.id = journal_lines.journal_entry_id
      and public.is_authorized_for_business(je.business_id)
  )
);

create policy "Journal lines are not deleted"
on public.journal_lines
for delete
using (false);

alter table public.accounting_periods enable row level security;
create policy "Business members can read accounting periods"
on public.accounting_periods
for select
using (public.is_authorized_for_business(business_id));

create policy "Business owners/admins can manage periods"
on public.accounting_periods
for insert
with check (public.is_business_owner_or_admin(business_id));

create policy "Business owners/admins can update periods"
on public.accounting_periods
for update
using (public.is_business_owner_or_admin(business_id))
with check (public.is_business_owner_or_admin(business_id));

create policy "Accounting periods are not deleted"
on public.accounting_periods
for delete
using (false);

alter table public.accounting_rules enable row level security;
create policy "Business members can read accounting rules"
on public.accounting_rules
for select
using (public.is_authorized_for_business(business_id));

create policy "Business owners/admins can manage rules"
on public.accounting_rules
for insert
with check (public.is_business_owner_or_admin(business_id));

create policy "Business owners/admins can update rules"
on public.accounting_rules
for update
using (public.is_business_owner_or_admin(business_id))
with check (public.is_business_owner_or_admin(business_id));

create policy "Accounting rules are not deleted"
on public.accounting_rules
for delete
using (false);

alter table public.bank_statements enable row level security;
create policy "Business members can read bank statements"
on public.bank_statements
for select
using (public.is_authorized_for_business(business_id));

create policy "Authorized members can create bank statements"
on public.bank_statements
for insert
with check (public.is_authorized_for_business(business_id));

create policy "Authorized members can update bank statements"
on public.bank_statements
for update
using (public.is_authorized_for_business(business_id))
with check (public.is_authorized_for_business(business_id));

create policy "Bank statements are not deleted"
on public.bank_statements
for delete
using (false);

alter table public.bank_transactions enable row level security;
create policy "Business members can read bank transactions"
on public.bank_transactions
for select
using (
  exists (
    select 1
    from public.bank_statements bs
    where bs.id = bank_transactions.bank_statement_id
      and public.is_authorized_for_business(bs.business_id)
  )
);

create policy "Authorized members can create bank transactions"
on public.bank_transactions
for insert
with check (
  exists (
    select 1
    from public.bank_statements bs
    where bs.id = bank_transactions.bank_statement_id
      and public.is_authorized_for_business(bs.business_id)
  )
);

create policy "Authorized members can update bank transactions"
on public.bank_transactions
for update
using (
  exists (
    select 1
    from public.bank_statements bs
    where bs.id = bank_transactions.bank_statement_id
      and public.is_authorized_for_business(bs.business_id)
  )
)
with check (
  exists (
    select 1
    from public.bank_statements bs
    where bs.id = bank_transactions.bank_statement_id
      and public.is_authorized_for_business(bs.business_id)
  )
);

create policy "Bank transactions are not deleted"
on public.bank_transactions
for delete
using (false);

alter table public.reconciliation_matches enable row level security;
create policy "Business members can read reconciliation matches"
on public.reconciliation_matches
for select
using (public.is_authorized_for_business(business_id));

create policy "Authorized members can create reconciliation matches"
on public.reconciliation_matches
for insert
with check (public.is_authorized_for_business(business_id));

create policy "Authorized members can update reconciliation matches"
on public.reconciliation_matches
for update
using (public.is_authorized_for_business(business_id))
with check (public.is_authorized_for_business(business_id));

create policy "Reconciliation matches are not deleted"
on public.reconciliation_matches
for delete
using (false);

alter table public.attachments enable row level security;
create policy "Business members can read attachments"
on public.attachments
for select
using (public.is_authorized_for_business(business_id));

create policy "Authorized members can create attachments"
on public.attachments
for insert
with check (public.is_authorized_for_business(business_id));

create policy "Authorized members can update attachments"
on public.attachments
for update
using (public.is_authorized_for_business(business_id))
with check (public.is_authorized_for_business(business_id));

create policy "Attachments are not deleted"
on public.attachments
for delete
using (false);

alter table public.audit_logs enable row level security;
create policy "Business members can read audit logs"
on public.audit_logs
for select
using (public.is_authorized_for_business(business_id));

create policy "Authorized members can create audit logs"
on public.audit_logs
for insert
with check (public.is_authorized_for_business(business_id));

create policy "Audit logs cannot be updated"
on public.audit_logs
for update
using (false)
with check (false);

create policy "Audit logs cannot be deleted"
on public.audit_logs
for delete
using (false);
