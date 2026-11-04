import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec('create role anon; create role authenticated; create role service_role; create table public.businesses(id uuid primary key);');
await db.exec(await readFile(new URL('../supabase/migrations/20261102055242_finance_trial_atomic_quotas.sql',import.meta.url),'utf8'));
const trial='11111111-1111-4111-8111-111111111111',business='22222222-2222-4222-8222-222222222222';
await db.query('insert into businesses values($1)',[business]);
const consume=(feature,n,expires='2099-01-01')=>db.query('select public.opsfinance_consume_trial_quota($1,$2,$3,$4,$5) as result',[trial,business,feature,`33333333-3333-4333-8333-${String(n).padStart(12,'0')}`,expires]);
for(const [feature,limit] of [['transactions',30],['bank_statements',2],['documents',5]]){
 for(let n=1;n<=limit;n++)assert.equal((await consume(feature,n)).rows[0].result.used,n);
 assert.equal((await consume(feature,1)).rows[0].result.replayed,true);
 await assert.rejects(consume(feature,limit+1),/limit reached/);
}
await assert.rejects(consume('transactions',1,'2000-01-01'),/Active verified/);
await db.exec('set role authenticated');
await assert.rejects(consume('transactions',1),/permission denied/);
await db.exec('reset role');
assert.equal((await db.query('select count(*)::int as count from opsfinance_trial_usage')).rows[0].count,37);

await db.exec(`create table public.business_members(business_id uuid,user_id uuid);
create table public.trial_test_postings(id uuid primary key);
create function public.post_accounting_transaction_atomic(uuid,text,text,date,text,text,numeric,uuid,uuid,text,text,jsonb) returns jsonb language plpgsql as $$
begin
 if $7<0 then raise exception 'Invalid posting'; end if;
 insert into trial_test_postings values($2::uuid) on conflict do nothing;
 return jsonb_build_object('transaction_id',$2);
end $$;`);
const user='44444444-4444-4444-8444-444444444444', postingTrial='55555555-5555-4555-8555-555555555555';
await db.query('insert into business_members values($1,$2)',[business,user]);
const post=(n,amount=1,expiry='2099-01-01')=>db.query('select public.opsfinance_trial_post_transaction($1,$2,$3,$4,$5::jsonb)',[user,business,postingTrial,expiry,JSON.stringify({p_idempotency_key:`66666666-6666-4666-8666-${String(n).padStart(12,'0')}`,p_amount:amount,p_transaction_date:'2026-11-02'})]);
await assert.rejects(post(100,-1),/Invalid posting/);
for(let i=1;i<=30;i++)await post(i);
await post(1);
await assert.rejects(post(31),/limit reached/);
assert.equal((await db.query('select count(*)::int as count from trial_test_postings')).rows[0].count,30);
await assert.rejects(post(1,1,'2000-01-01'),/Active verified/);
await db.exec('set role authenticated');
await assert.rejects(post(1),/permission denied/);
await db.exec('reset role');
console.log('PASS: posting wrapper commits data/quota together, rollback at 31, replay, invalid posting, expiry and browser denial');
await db.close();
console.log('PASS: 30/2/5 caps, replay idempotency, expiry, browser denial and rejected writes do not consume quota');
