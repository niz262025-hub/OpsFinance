import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const db=new PGlite({extensions:{pgcrypto}});
await db.exec(fs.readFileSync(root+'/scripts/local-supabase-emulator.sql','utf8'));
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
await db.exec('reset role; set role anon');
await assert.rejects(db.query("select public.get_accounting_idempotency('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','private-b-key')"),/permission denied/);
console.log('PASS: own-business access, cross-business read/write denial, anonymous RPC denial');
await db.exec("reset role; set role authenticated; select set_config('app.session_user_id','11111111-1111-1111-1111-111111111111',false)");
const created=await db.query("select public.create_business_with_owner(' New Business  ','REG-1',null,'+6012345','owner@test.invalid','MYR',null) as id");
const newBusinessId=created.rows[0].id;
assert.equal((await db.query('select count(*)::int as count from business_members where business_id=$1 and user_id=$2 and role=$3',[newBusinessId,'11111111-1111-1111-1111-111111111111','OWNER'])).rows[0].count,1);
assert.equal((await db.query('select name from businesses where id=$1',[newBusinessId])).rows[0].name,'New Business');
assert.equal((await db.query('select count(*)::int as count from subscriptions where business_id=$1',[newBusinessId])).rows[0].count,0);
await assert.rejects(db.query("select public.create_business_with_owner('   ',null,null,null,null,'MYR',null)"),/Business name must contain/);
console.log('PASS: secure business bootstrap creates owner membership without billing or trial');
await db.close();
