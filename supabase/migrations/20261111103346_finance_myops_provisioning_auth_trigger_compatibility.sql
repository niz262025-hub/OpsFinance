-- Server-only provisioning from a verified MYOPS grant, compatible with the
-- deployed auth.users profile-sync trigger. No customer identity is reassigned.
-- Invoker permissions are limited to the server role; no browser grants change.
grant select (id,email,email_confirmed_at,raw_app_meta_data) on auth.users to service_role;
grant select,insert on public.users,public.businesses,public.business_members to service_role;
create or replace function public.opsfinance_provision_myops_identity(
 p_user_ref text,p_user_id uuid,p_email text,p_display_name text,p_company_name text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_link public.myops_identity_links%rowtype; v_business uuid;
begin
 if p_user_ref is null or p_user_ref !~ '^[A-Za-z0-9_-]{43}$' or p_user_id is null
  or nullif(trim(p_display_name),'') is null or length(trim(p_display_name))>100
  or nullif(trim(p_company_name),'') is null or length(trim(p_company_name))>160 then
  raise exception 'Invalid MYOPS company profile';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('finance-myops:'||p_user_ref,0));
 select * into v_link from public.myops_identity_links where user_ref=p_user_ref for update;
 if found then
  if not v_link.enabled or v_link.supabase_user_id<>p_user_id then raise exception 'MYOPS identity unavailable'; end if;
  return jsonb_build_object('supabase_user_id',v_link.supabase_user_id,'business_id',v_link.business_id);
 end if;
 -- Only app-owned auth identities may be bootstrapped. User-editable metadata
 -- is not used to authorize the mapping; labels are descriptive only.
 if not exists(select 1 from auth.users where id=p_user_id and email=p_email and email_confirmed_at is not null
  and raw_app_meta_data->>'myops_user_ref'=p_user_ref and raw_app_meta_data->>'myops_bridge'='opsfinance-v1') then
  raise exception 'Verified MYOPS identity required';
 end if;
 -- An auth trigger may have already inserted the same app-owned profile.
 -- Refuse an unrelated profile or any identity that already belongs to a tenant.
 if exists(select 1 from public.users where id=p_user_id and email is distinct from p_email)
  or exists(select 1 from public.business_members where user_id=p_user_id)
  or exists(select 1 from public.myops_identity_links where supabase_user_id=p_user_id) then
  raise exception 'Existing identity cannot be reassigned';
 end if;
 insert into public.users(id,email,name) values(p_user_id,p_email,trim(p_display_name))
 on conflict (id) do nothing;
 insert into public.businesses(name) values(trim(p_company_name)) returning id into v_business;
 insert into public.business_members(business_id,user_id,role) values(v_business,p_user_id,'OWNER');
 insert into public.myops_identity_links(user_ref,supabase_user_id,business_id,enabled) values(p_user_ref,p_user_id,v_business,true);
 return jsonb_build_object('supabase_user_id',p_user_id,'business_id',v_business);
end $$;
revoke all on function public.opsfinance_provision_myops_identity(text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.opsfinance_provision_myops_identity(text,uuid,text,text,text) to service_role;
