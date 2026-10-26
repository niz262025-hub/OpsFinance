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
await db.exec(`INSERT INTO users(id,email,name) VALUES ('11111111-1111-1111-1111-111111111111','a@test.invalid','A'),('22222222-2222-2222-2222-222222222222','b@test.invalid','B'); INSERT INTO businesses(id,name) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','A'),('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','B'); INSERT INTO business_members(business_id,user_id,role) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','OWNER'),('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','22222222-2222-2222-2222-222222222222','OWNER'); INSERT INTO idempotency_keys(business_id,idempotency_key,result_id) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','private-b-key','33333333-3333-3333-3333-333333333333'); GRANT USAGE ON SCHEMA public TO authenticated; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated; SET ROLE authenticated; SELECT set_config('app.session_user_id','11111111-1111-1111-1111-111111111111',false);`);
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
assert.equal((await db.query('select * from public.myops_identity_links')).rows.length,0);
await db.exec('reset role; set role service_role');
assert.equal((await db.query('select enabled from public.myops_identity_links')).rows[0].enabled,false);
console.log('PASS: identity provisioning requires existing membership; browser roles cannot read mappings');
console.log('PASS: own-business access, cross-business read/write denial, anonymous RPC denial');
await db.close();
