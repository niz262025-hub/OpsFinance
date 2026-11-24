// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { expect,it } from 'vitest';
it('requires an existing linked identity and business membership and denies browser reads',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
   create table public.myops_identity_links(user_ref text primary key,supabase_user_id uuid);
   create table public.business_members(business_id uuid,user_id uuid,unique(business_id,user_id));`);
  await db.exec(await readFile('supabase/migrations/20261124080531_opsfinance_central_organization_mapping.sql','utf8'));
  const u='00000000-0000-4000-8000-000000000001', b='00000000-0000-4000-8000-000000000002', other='00000000-0000-4000-8000-000000000003',org='00000000-0000-4000-8000-000000000004';
  await db.query('insert into myops_identity_links values($1,$2)',['r'.repeat(43),u]);
  await db.query('insert into business_members values($1,$2)',[b,u]);
  await expect(db.query('insert into myops_organization_business_links(organization_id,user_ref,supabase_user_id,business_id,enabled) values($1,$2,$3,$4,true)',[org,'r'.repeat(43),u,other])).rejects.toThrow();
  await db.query('insert into myops_organization_business_links(organization_id,user_ref,supabase_user_id,business_id,enabled) values($1,$2,$3,$4,true)',[org,'r'.repeat(43),u,b]);
  await db.exec('set role authenticated');
  await expect(db.query('select * from myops_organization_business_links')).rejects.toThrow();
 } finally {await db.close();}
},15000);
