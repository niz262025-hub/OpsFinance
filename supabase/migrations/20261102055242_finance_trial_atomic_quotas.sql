-- Prepared only: apply after Finance write gateway integration and SQL regression.
-- The browser has no permissions on these server-owned records.
create table public.opsfinance_trial_bindings (
 trial_id uuid primary key,
 business_id uuid not null references public.businesses(id)
);
alter table public.opsfinance_trial_bindings enable row level security;
revoke all on public.opsfinance_trial_bindings from public,anon,authenticated;
grant select,insert,update on public.opsfinance_trial_bindings to service_role;
create table public.opsfinance_trial_usage (
 trial_id uuid not null,
 business_id uuid not null references public.businesses(id),
 feature text not null check(feature in ('transactions','bank_statements','documents')),
 operation_id uuid not null,
 created_at timestamptz not null default now(),
 primary key(trial_id,feature,operation_id)
);
alter table public.opsfinance_trial_usage enable row level security;
revoke all on public.opsfinance_trial_usage from public,anon,authenticated;
grant select,insert on public.opsfinance_trial_usage to service_role;

-- Called within the SAME database transaction as its business operation.
-- Never use this RPC as a standalone pre-charge from an HTTP request.
create function public.opsfinance_consume_trial_quota(
 p_trial_id uuid,p_business_id uuid,p_feature text,p_operation_id uuid,p_expires_at timestamptz
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_limit integer; v_used integer;
begin
 if p_trial_id is null or p_business_id is null or p_operation_id is null
  or p_expires_at is null or p_expires_at<=now() then
  raise exception 'Active verified Finance trial required';
 end if;
 v_limit:=case p_feature when 'transactions' then 30 when 'bank_statements' then 2 when 'documents' then 5 else null end;
 if v_limit is null then raise exception 'Unsupported Finance trial feature'; end if;
 insert into public.opsfinance_trial_bindings(trial_id,business_id) values(p_trial_id,p_business_id) on conflict(trial_id) do nothing;
 perform 1 from public.opsfinance_trial_bindings where trial_id=p_trial_id and business_id=p_business_id for update;
 if not found then raise exception 'Trial business binding mismatch'; end if;
 -- Trial and business locks serialize counters and prevent cross-business reuse.
 perform 1 from public.businesses where id=p_business_id for update;
 if not found then raise exception 'Finance business unavailable'; end if;
 if exists(select 1 from public.opsfinance_trial_usage where trial_id=p_trial_id and business_id<>p_business_id) then
  raise exception 'Trial business binding mismatch';
 end if;
 if exists(select 1 from public.opsfinance_trial_usage where trial_id=p_trial_id and feature=p_feature and operation_id=p_operation_id) then
  select count(*) into v_used from public.opsfinance_trial_usage where trial_id=p_trial_id and feature=p_feature;
  return jsonb_build_object('used',v_used,'limit',v_limit,'replayed',true);
 end if;
 select count(*) into v_used from public.opsfinance_trial_usage where trial_id=p_trial_id and feature=p_feature;
 if v_used>=v_limit then raise exception 'Finance trial usage limit reached'; end if;
 insert into public.opsfinance_trial_usage(trial_id,business_id,feature,operation_id) values(p_trial_id,p_business_id,p_feature,p_operation_id);
 return jsonb_build_object('used',v_used+1,'limit',v_limit,'replayed',false);
end $$;
revoke all on function public.opsfinance_consume_trial_quota(uuid,uuid,text,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.opsfinance_consume_trial_quota(uuid,uuid,text,uuid,timestamptz) to service_role;

-- Server-only posting adapter. The existing accounting function retains its
-- membership, balancing, account, journal and idempotency validations.
create function public.opsfinance_trial_post_transaction(
 p_user_id uuid,p_business_id uuid,p_trial_id uuid,p_expires_at timestamptz,p_payload jsonb
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_result jsonb; v_subject text; v_claims text;
begin
 if p_user_id is null or p_trial_id is null or p_expires_at is null or p_expires_at<=now() then
  raise exception 'Active verified Finance trial required';
 end if;
 if not exists(select 1 from public.business_members where business_id=p_business_id and user_id=p_user_id) then
  raise exception 'Business access denied';
 end if;
 if p_payload ? 'p_business_id' and (p_payload->>'p_business_id')::uuid<>p_business_id then
  raise exception 'Trial business binding mismatch';
 end if;
 v_subject:=current_setting('request.jwt.claim.sub',true);
 v_claims:=current_setting('request.jwt.claims',true);
 perform set_config('request.jwt.claim.sub',p_user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_user_id,'role','authenticated')::text,true);
 v_result:=public.post_accounting_transaction_atomic(
  p_business_id,p_payload->>'p_idempotency_key',p_payload->>'p_transaction_type',
  (p_payload->>'p_transaction_date')::date,p_payload->>'p_description',p_payload->>'p_reference_no',
  (p_payload->>'p_amount')::numeric,(p_payload->>'p_financial_account_id')::uuid,
  (p_payload->>'p_account_id')::uuid,p_payload->>'p_journal_no',p_payload->>'p_journal_description',p_payload->'p_lines');
 -- A quota error rolls back the posting, journal and idempotency result together.
 perform public.opsfinance_consume_trial_quota(p_trial_id,p_business_id,'transactions',(v_result->>'transaction_id')::uuid,p_expires_at);
 perform set_config('request.jwt.claim.sub',coalesce(v_subject,''),true);
 perform set_config('request.jwt.claims',coalesce(v_claims,''),true);
 return v_result;
end $$;
revoke all on function public.opsfinance_trial_post_transaction(uuid,uuid,uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.opsfinance_trial_post_transaction(uuid,uuid,uuid,timestamptz,jsonb) to service_role;
