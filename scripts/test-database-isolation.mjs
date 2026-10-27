import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const db=new PGlite({extensions:{pgcrypto}});
await db.exec(fs.readFileSync(root+'/scripts/local-supabase-emulator.sql','utf8'));
await db.exec('create role service_role nologin bypassrls; create table auth.users(id uuid primary key)');
for(const file of fs.readdirSync(root+'/supabase/migrations').sort()) {
 try{await db.exec(fs.readFileSync(root+'/supabase/migrations/'+file,'utf8')); console.log('PASS replay',file)}catch(e){console.log('FAIL replay',file,e.message);process.exit(1)}
}
// Test the actual migration grants before the fixture-only writes below: broad
// grants here previously hid missing production/staging Data API privileges.
assert.equal((await db.query("select has_table_privilege('authenticated','public.business_members','SELECT') as allowed")).rows[0].allowed,true);
assert.equal((await db.query("select has_table_privilege('authenticated','public.businesses','SELECT') as allowed")).rows[0].allowed,true);
assert.equal((await db.query("select has_table_privilege('authenticated','public.myops_identity_links','SELECT') as allowed")).rows[0].allowed,false);
await db.exec(`INSERT INTO users(id,email,name) VALUES ('11111111-1111-1111-1111-111111111111','a@test.invalid','A'),('22222222-2222-2222-2222-222222222222','b@test.invalid','B'); INSERT INTO businesses(id,name) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','A'),('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','B'); INSERT INTO business_members(business_id,user_id,role) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','OWNER'),('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','22222222-2222-2222-2222-222222222222','OWNER'); INSERT INTO idempotency_keys(business_id,idempotency_key,result_id) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','private-b-key','33333333-3333-3333-3333-333333333333'); GRANT USAGE ON SCHEMA public TO authenticated; GRANT SELECT,INSERT,UPDATE,DELETE ON public.idempotency_keys TO authenticated; SET ROLE authenticated; SELECT set_config('app.session_user_id','11111111-1111-1111-1111-111111111111',false);`);
assert.deepEqual((await db.query('select name from businesses')).rows,[{name:'A'}]);
assert.equal((await db.query("select get_accounting_idempotency('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','private-b-key') as result")).rows[0].result,null);
assert.equal((await db.query('select * from idempotency_keys')).rows.length,0);
await assert.rejects(db.exec("insert into idempotency_keys(business_id,idempotency_key) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','attack')"), /row-level security/);
await db.exec("select set_config('app.session_user_id','22222222-2222-2222-2222-222222222222',false)");
assert.equal((await db.query("select get_accounting_idempotency('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','private-b-key') as result")).rows[0].result,'33333333-3333-3333-3333-333333333333');
assert.equal((await db.query('select * from idempotency_keys')).rows.length,1);
// Reproduce legacy hosted ACLs: anon can have a direct grant independent of PUBLIC.
await db.exec('reset role; grant execute on function public.get_accounting_idempotency(uuid,text,text) to anon');
assert.equal((await db.query("select has_function_privilege('anon','public.get_accounting_idempotency(uuid,text,text)','EXECUTE') as allowed")).rows[0].allowed,true);
const aclMigration=fs.readdirSync(root+'/supabase/migrations').find(file=>file.endsWith('_revoke_legacy_anonymous_idempotency_rpc.sql'));
assert.ok(aclMigration);
await db.exec(fs.readFileSync(root+'/supabase/migrations/'+aclMigration,'utf8'));
await db.exec(fs.readFileSync(root+'/supabase/migrations/'+aclMigration,'utf8'));
assert.equal((await db.query("select has_function_privilege('anon','public.get_accounting_idempotency(uuid,text,text)','EXECUTE') as allowed")).rows[0].allowed,false);
assert.equal((await db.query("select has_function_privilege('authenticated','public.get_accounting_idempotency(uuid,text,text)','EXECUTE') as allowed")).rows[0].allowed,true);
await db.exec('set role anon');
await assert.rejects(db.query("select public.get_accounting_idempotency('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','private-b-key')"),/permission denied/);
await db.exec('reset role');
await db.exec("insert into auth.users(id) values ('11111111-1111-1111-1111-111111111111')");
await assert.rejects(db.query("insert into public.myops_identity_links(user_ref,supabase_user_id,business_id) values ($1,'11111111-1111-1111-1111-111111111111','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')",['x'.repeat(43)]),/foreign key/);
await db.query("insert into public.myops_identity_links(user_ref,supabase_user_id,business_id) values ($1,'11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')",['x'.repeat(43)]);
await db.exec('set role authenticated');
await assert.rejects(db.query('select * from public.myops_identity_links'),/permission denied/);
await db.exec('reset role; set role service_role');
assert.equal((await db.query('select enabled from public.myops_identity_links')).rows[0].enabled,false);
console.log('PASS: identity provisioning requires existing membership; browser roles cannot read mappings');
console.log('PASS: own-business access, cross-business read/write denial, anonymous RPC denial');
await db.exec(`reset role; update private.myops_broker_config set key_hash=encode(sha256(convert_to(repeat('k',48),'UTF8')),'hex'),enabled=true where id=true; set role authenticated; select set_config('app.session_user_id','11111111-1111-1111-1111-111111111111',false);`);
assert.equal((await db.query('select * from businesses')).rows.length,0);
await assert.rejects(db.query('select private.myops_check_request()'),/MYOPS application access required/);
await assert.rejects(db.query('select * from private.myops_broker_config'),/permission denied/);
await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-myops-broker-key':'wrong'.repeat(12)})]);
assert.equal((await db.query('select * from businesses')).rows.length,0);
await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-myops-broker-key':'k'.repeat(48)})]);
await db.query('select private.myops_check_request()');
assert.deepEqual((await db.query('select name from businesses')).rows,[{name:'A'}]);
assert.equal((await db.query('select * from idempotency_keys')).rows.length,0);
await assert.rejects(db.exec("insert into idempotency_keys(business_id,idempotency_key) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','broker-cross-tenant')"),/row-level security/);
await db.exec("select set_config('request.headers','malformed',false)");
assert.equal((await db.query('select private.myops_broker_allowed() as allowed')).rows[0].allowed,false);
await db.exec('reset role; update private.myops_broker_config set enabled=false where id=true; set role authenticated');
assert.deepEqual((await db.query('select name from businesses')).rows,[{name:'A'}]);
console.log('PASS: broker gate rejects absent/wrong/malformed credentials; valid broker preserves tenant isolation; rollback restores prior access');
await db.exec(`reset role;
INSERT INTO accounts(id,business_id,code,name,account_type,normal_balance) VALUES
('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','A1','A cash','ASSET','DEBIT'),
('bbbbbbbb-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','B1','B cash','ASSET','DEBIT');
INSERT INTO journal_entries(id,business_id,journal_no,journal_date) VALUES
('aaaaaaaa-0000-0000-0000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','J1','2026-10-26');
INSERT INTO journal_lines(id,journal_entry_id,account_id,debit) VALUES
('aaaaaaaa-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001',10);`);
// Exercise the trigger even with RLS bypass, as for an accidental service-role write.
await assert.rejects(db.exec("INSERT INTO journal_lines(journal_entry_id,account_id,debit) VALUES ('aaaaaaaa-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000001',10)"), /does not belong/);
await assert.rejects(db.exec("UPDATE journal_lines SET account_id='bbbbbbbb-0000-0000-0000-000000000001' WHERE id='aaaaaaaa-0000-0000-0000-000000000003'"), /does not belong/);
assert.equal((await db.query("SELECT account_id FROM journal_lines WHERE id='aaaaaaaa-0000-0000-0000-000000000003'")).rows[0].account_id, 'aaaaaaaa-0000-0000-0000-000000000001');
await db.exec("INSERT INTO financial_accounts(id,business_id,name,type,account_code) VALUES ('bbbbbbbb-0000-0000-0000-000000000004','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','B bank','BANK','BANK1')");
await assert.rejects(db.exec("UPDATE journal_lines SET financial_account_id='bbbbbbbb-0000-0000-0000-000000000004' WHERE id='aaaaaaaa-0000-0000-0000-000000000003'"), /does not belong/);
console.log('PASS: cross-business journal account and financial-account references denied; original line preserved');
await db.exec("reset role; set role authenticated; select set_config('app.session_user_id','11111111-1111-1111-1111-111111111111',false)");
const created=await db.query("select public.create_business_with_owner(' New Business  ','REG-1',null,'+6012345','owner@test.invalid','MYR',null) as id");
const newBusinessId=created.rows[0].id;
assert.equal((await db.query('select count(*)::int as count from business_members where business_id=$1 and user_id=$2 and role=$3',[newBusinessId,'11111111-1111-1111-1111-111111111111','OWNER'])).rows[0].count,1);
assert.equal((await db.query('select name from businesses where id=$1',[newBusinessId])).rows[0].name,'New Business');
await db.exec('reset role');
assert.equal((await db.query('select count(*)::int as count from subscriptions where business_id=$1',[newBusinessId])).rows[0].count,0);
await db.exec('set role authenticated');
await assert.rejects(db.query("select public.create_business_with_owner('   ',null,null,null,null,'MYR',null)"),/Business name must contain/);
console.log('PASS: secure business bootstrap creates owner membership without billing or trial');
await db.close();
