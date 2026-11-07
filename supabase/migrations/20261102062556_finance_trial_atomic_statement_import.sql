create table public.opsfinance_trial_import_receipts (
 trial_id uuid not null, statement_id uuid not null references public.bank_statements(id),
 content_hash text not null check(content_hash~'^[0-9a-f]{64}$'),
 business_id uuid not null references public.businesses(id),
 financial_account_id uuid not null references public.financial_accounts(id),
 primary key(trial_id,statement_id)
);
alter table public.opsfinance_trial_import_receipts enable row level security;
revoke all on public.opsfinance_trial_import_receipts from public,anon,authenticated;
grant select,insert on public.opsfinance_trial_import_receipts to service_role;
create function public.opsfinance_trial_import_statement(
 p_user_id uuid,p_business_id uuid,p_trial_id uuid,p_expires_at timestamptz,
 p_statement jsonb,p_rows jsonb,p_content_hash text
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare sid uuid:=(p_statement->>'id')::uuid; fid uuid:=(p_statement->>'financial_account_id')::uuid; saved public.opsfinance_trial_import_receipts; result jsonb;
begin
 if p_user_id is null or p_trial_id is null or p_expires_at is null or p_expires_at<=now() then raise exception 'Active verified Finance trial required'; end if;
 if not exists(select 1 from public.business_members where business_id=p_business_id and user_id=p_user_id) then raise exception 'Business access denied'; end if;
 if (p_statement->>'business_id')::uuid is distinct from p_business_id or (p_statement->>'uploaded_by')::uuid is distinct from p_user_id then raise exception 'Trial business binding mismatch'; end if;
 if p_content_hash is null or p_content_hash!~'^[0-9a-f]{64}$' or sid is null or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>30 then raise exception 'Invalid trial statement'; end if;
 if not exists(select 1 from public.financial_accounts where id=fid and business_id=p_business_id and status='ACTIVE') then raise exception 'Financial account does not belong to this business'; end if;
 perform public.opsfinance_consume_trial_quota(p_trial_id,p_business_id,'bank_statements',sid,p_expires_at);
 perform 1 from public.businesses where id=p_business_id for update;
 select * into saved from public.opsfinance_trial_import_receipts where trial_id=p_trial_id and statement_id=sid;
 if found then
  if saved.content_hash<>p_content_hash or saved.business_id<>p_business_id or saved.financial_account_id<>fid then raise exception 'Statement retry identity mismatch'; end if;
 else
  if exists(select 1 from jsonb_array_elements(p_rows) r where (r->>'bank_statement_id')::uuid is distinct from sid or r->>'status' is distinct from 'IMPORTED') then raise exception 'Invalid trial statement rows'; end if;
  insert into public.bank_statements select * from jsonb_populate_record(null::public.bank_statements,p_statement||jsonb_build_object('status','IMPORTED','created_at',now()));
  insert into public.bank_transactions select * from jsonb_populate_recordset(null::public.bank_transactions,p_rows);
  insert into public.opsfinance_trial_import_receipts values(p_trial_id,sid,p_content_hash,p_business_id,fid);
  insert into public.audit_logs(business_id,user_id,action,entity_type,entity_id,metadata) values(p_business_id,p_user_id,'UPLOAD_IMPORTED','BANK_STATEMENT',sid,jsonb_build_object('trial',true,'transaction_count',jsonb_array_length(p_rows)));
 end if;
 select coalesce(jsonb_agg(to_jsonb(b)),'[]'::jsonb) into result from public.bank_transactions b where bank_statement_id=sid;
 return jsonb_build_object('statementId',sid,'bankTransactions',result);
end $$;
revoke all on function public.opsfinance_trial_import_statement(uuid,uuid,uuid,timestamptz,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.opsfinance_trial_import_statement(uuid,uuid,uuid,timestamptz,jsonb,jsonb,text) to service_role;
