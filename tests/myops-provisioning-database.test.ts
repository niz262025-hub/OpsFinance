// @vitest-environment node
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';

it('atomically provisions an empty company, preserves retries, and denies disabled mappings and browser callers',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb);
 create table public.users(id uuid primary key,email text unique,name text);
 create table businesses(id uuid primary key default gen_random_uuid(),name text);
 create table business_members(business_id uuid references businesses(id),user_id uuid references public.users(id),role text,unique(business_id,user_id));`);
 await db.exec(readFileSync('supabase/migrations/20261026171551_myops_identity_links.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261102065104_finance_myops_identity_provisioning.sql','utf8'));
 const ref='u'.repeat(43),id='11111111-1111-4111-8111-111111111111';
 await db.query('insert into auth.users values($1,$2,now(),$3)',[id,'internal@identity.opsfinance.invalid',JSON.stringify({myops_user_ref:ref,myops_bridge:'opsfinance-v1'})]);
 await db.exec('grant usage on schema auth to service_role; set role service_role');
 const call=(company='Central Company')=>db.query<any>('select public.opsfinance_provision_myops_identity($1,$2,$3,$4,$5) as result',[ref,id,'internal@identity.opsfinance.invalid','Owner',company]);
 const first=(await call()).rows[0].result;
 expect((await call('New label')).rows[0].result).toEqual(first);
 expect((await db.query('select name from businesses')).rows).toEqual([{name:'Central Company'}]);
 expect((await db.query('select role from business_members')).rows).toEqual([{role:'OWNER'}]);
 await db.exec('reset role;set role authenticated');await expect(call()).rejects.toThrow('permission denied');await db.exec('reset role');
 await db.exec('update myops_identity_links set enabled=false');await expect(call()).rejects.toThrow('unavailable');
 expect((await db.query('select count(*)::int as n from businesses')).rows).toEqual([{n:1}]);
 }finally{await db.close();}
},20000);

it('accepts the production auth-trigger profile but rejects existing tenant membership and unrelated profiles',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb);
 create table public.users(id uuid primary key,email text unique,name text);
 create table businesses(id uuid primary key default gen_random_uuid(),name text);
 create table business_members(business_id uuid references businesses(id),user_id uuid references public.users(id),role text,unique(business_id,user_id));
 create function public.sync_test_auth_profile() returns trigger language plpgsql as $$begin
 insert into public.users values(new.id,new.email,'trigger profile');return new;end$$;
 create trigger sync_public_user_profile after insert on auth.users for each row execute function public.sync_test_auth_profile();`);
 await db.exec(readFileSync('supabase/migrations/20261026171551_myops_identity_links.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261111103346_finance_myops_provisioning_auth_trigger_compatibility.sql','utf8'));
 const ref='u'.repeat(43),id='11111111-1111-4111-8111-111111111111';
 const email='internal@identity.opsfinance.invalid';
 await db.query('insert into auth.users values($1,$2,now(),$3)',[id,email,JSON.stringify({myops_user_ref:ref,myops_bridge:'opsfinance-v1'})]);
 await db.exec('grant usage on schema auth to service_role;set role service_role');
 const call=()=>db.query<any>('select public.opsfinance_provision_myops_identity($1,$2,$3,$4,$5) as result',[ref,id,email,'Owner','Company']);
 const first=(await call()).rows[0].result;
 expect((await call()).rows[0].result).toEqual(first);
 expect((await db.query<{n:number}>('select count(*)::int n from businesses')).rows[0].n).toBe(1);
 expect((await db.query<{n:number}>('select count(*)::int n from public.users')).rows[0].n).toBe(1);
 await db.exec('reset role;delete from myops_identity_links;set role service_role');
 await expect(call()).rejects.toThrow('Existing identity cannot be reassigned');
 await db.exec("reset role;delete from business_members;update public.users set email='unrelated@example.invalid';set role service_role");
 await expect(call()).rejects.toThrow('Existing identity cannot be reassigned');
 await db.exec('reset role;set role authenticated');await expect(call()).rejects.toThrow('permission denied');
 }finally{await db.close();}
},20000);
