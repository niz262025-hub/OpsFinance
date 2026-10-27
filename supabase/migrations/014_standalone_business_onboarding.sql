-- Business creation is part of the standalone accounting app. Do not create
-- trials or subscriptions here; central MYOPS access and payments are separate.
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
  v_name text := nullif(trim(p_name), '');
begin
  if v_user_id is null then
    raise exception 'Authenticated user required to create a business.';
  end if;

  if not exists (select 1 from public.users u where u.id = v_user_id) then
    raise exception 'Authenticated user profile required to create a business.';
  end if;

  if v_name is null or length(v_name) > 160 then
    raise exception 'Business name must contain between 1 and 160 characters.';
  end if;

  insert into public.businesses (
    name, registration_no, address, phone, email, base_currency, fiscal_year_start
  ) values (
    v_name,
    nullif(trim(p_registration_no), ''),
    nullif(trim(p_address), ''),
    nullif(trim(p_phone), ''),
    nullif(trim(p_email), ''),
    coalesce(nullif(trim(p_base_currency), ''), 'MYR'),
    nullif(trim(p_fiscal_year_start), '')
  )
  returning id into v_business_id;

  insert into public.business_members (business_id, user_id, role)
  values (v_business_id, v_user_id, 'OWNER')
  on conflict (business_id, user_id) do nothing;

  return v_business_id;
end;
$$;

revoke all on function public.create_business_with_owner(text, text, text, text, text, text, text) from public;
grant execute on function public.create_business_with_owner(text, text, text, text, text, text, text) to authenticated;
