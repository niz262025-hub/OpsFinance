-- Profile forms send only these editable fields. Existing owner/admin UPDATE
-- policies and the restrictive MYOPS broker policy still authorize every row.
grant update (name,registration_no,address,phone,email,base_currency,fiscal_year_start,updated_at)
 on public.businesses to authenticated;

-- Browser roles do not perform schema operations. TRUNCATE is not governed by
-- row-level policies, so never retain the platform's historical broad grant.
do $$
declare target record;
begin
 for target in
  select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p')
 loop
  execute format('revoke truncate,references,trigger on table %I.%I from public,anon,authenticated',target.nspname,target.relname);
 end loop;
end $$;
