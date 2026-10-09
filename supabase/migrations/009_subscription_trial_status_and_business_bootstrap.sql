alter type public.subscription_status_enum add value if not exists 'TRIAL';
alter type public.subscription_status_enum add value if not exists 'CANCELLED';

create unique index if not exists idx_subscriptions_business_id_unique
  on public.subscriptions (business_id);

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
  v_now timestamptz := now();
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
  values (v_business_id, v_user_id, 'OWNER')
  on conflict (business_id, user_id) do nothing;

  insert into public.subscriptions (
    business_id,
    plan_code,
    status,
    current_period_start,
    current_period_end,
    trial_started_at,
    trial_ends_at,
    created_at,
    updated_at
  )
  values (
    v_business_id,
    'STARTER',
    'TRIAL',
    v_now,
    v_now + interval '30 days',
    v_now,
    v_now + interval '7 days',
    v_now,
    v_now
  )
  on conflict (business_id) do nothing;

  return v_business_id;
end;
$$;

revoke all on function public.create_business_with_owner(text, text, text, text, text, text, text) from public;
grant execute on function public.create_business_with_owner(text, text, text, text, text, text, text) to authenticated;
