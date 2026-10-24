-- Forward-only hardening: idempotency metadata belongs to its business.
alter table public.idempotency_keys enable row level security;
create policy idempotency_members_read on public.idempotency_keys
  for select to authenticated
  using (public.is_authorized_for_business(business_id));

create or replace function public.get_accounting_idempotency(
  p_business_id uuid,
  p_idempotency_key text,
  p_operation_type text default 'ACCOUNTING_POST'
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select ik.result_id
  from public.idempotency_keys ik
  where ik.business_id = p_business_id
    and ik.idempotency_key = p_idempotency_key
    and ik.operation_type = p_operation_type
    and exists (
      select 1 from public.business_members bm
      where bm.business_id = ik.business_id and bm.user_id = auth.uid()
    )
  order by ik.created_at desc
  limit 1;
$$;
revoke all on function public.get_accounting_idempotency(uuid, text, text) from public;
grant execute on function public.get_accounting_idempotency(uuid, text, text) to authenticated;
