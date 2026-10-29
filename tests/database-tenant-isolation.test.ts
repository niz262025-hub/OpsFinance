// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

import { persistBankStatementImport, getReconciliationSnapshot, assertBusinessMembership, postApprovedBankImport, createReconciliationMatch, completeReconciliation } from '../lib/accounting/server-operations';
import { workflowClient } from './helpers/pglite-workflow-client';

const userA = '10000000-0000-0000-0000-000000000001';
const userB = '10000000-0000-0000-0000-000000000002';
let db: PGlite;
let businessA: string;
let businessB: string;
let accountA: string;
let accountB: string;
let cashA: string;
let cashB: string;
async function scalar(sql: string, params: any[] = []) {
  return (await db.query<any>(sql, params)).rows[0]?.value;
}
async function asUser(user: string) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
  await db.exec('set role authenticated');
}
async function post(business: string, key: string, account: string, financial: string, lineFinancial = financial) {
  return scalar(`select public.post_accounting_transaction_atomic($1,$2,'MONEY_IN','2026-10-19','test',$2,10,$3,$4,$2,'test',$5::jsonb) as value`,
    [business, key, financial, account, JSON.stringify([
      { account_id: account, financial_account_id: lineFinancial, debit: 10, credit: 0 },
      { account_id: account, credit: 10, debit: 0 },
    ])]);
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  // Emulate Supabase roles and JWT subject; no remote database or credentials are used.
  await db.exec(`create role anon; create role authenticated; create role service_role nologin bypassrls; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$; grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;`);
  const files = readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort();
  expect(new Set(files.map(f => f.split('_')[0])).size).toBe(files.length);
  for (const file of files) {
    const sql = readFileSync(`supabase/migrations/${file}`, 'utf8');
    try { await db.exec(sql); } catch (error) { throw new Error(`Migration ${file}: ${String(error)}`); }
  }
  await db.exec(`grant usage on schema public to authenticated, anon;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    insert into public.users(id,email,name) values ('${userA}','a@example.test','A'),('${userB}','b@example.test','B');`);
  await asUser(userA);
  businessA = await scalar("select public.create_business_with_owner('A') as value");
  await asUser(userB);
  businessB = await scalar("select public.create_business_with_owner('B') as value");
  await db.exec('reset role');
  for (const business of [businessA, businessB]) {
    const account = await scalar("insert into public.accounts(business_id,code,name,account_type,normal_balance) values ($1,'1000','Cash','ASSET','DEBIT') returning id as value", [business]);
    const cash = await scalar("insert into public.financial_accounts(business_id,name,type,account_code,account_id) values ($1,'Cash','CASH','CASH',$2) returning id as value", [business, account]);
    if (business === businessA) { accountA = account; cashA = cash; } else { accountB = account; cashB = cash; }
  }
}, 60000);
afterAll(async () => { await db?.close(); });

describe.sequential('PostgreSQL migration replay and tenant A/B boundaries', () => {
  it('creates memberships without requiring or creating subscriptions', async () => {
    await db.exec('reset role');
    expect(await scalar('select count(*)::int as value from public.subscriptions')).toBe(0);
    expect(await scalar('select count(*)::int as value from public.business_members')).toBe(2);
  });
  it('RLS hides business B and rejects cross-business account inserts and updates', async () => {
    await asUser(userA);
    expect(await scalar('select count(*)::int as value from public.accounts where business_id=$1', [businessB])).toBe(0);
    await expect(db.query("insert into public.accounts(business_id,code,name,account_type,normal_balance) values ($1,'bad','Bad','ASSET','DEBIT')", [businessB])).rejects.toThrow(/row-level security/);
    expect((await db.query("update public.accounts set name='bad' where id=$1 returning id", [accountB])).rows).toHaveLength(0);
  });
  it('posts a balanced journal atomically and returns the same transaction on retry', async () => {
    await asUser(userA);
    const first = await post(businessA, 'same-key', accountA, cashA);
    expect(first.status).toBe('POSTED');
    const retry = await post(businessA, 'same-key', accountA, cashA);
    expect(retry.status).toBe('DUPLICATE');
    expect(retry.transaction_id).toBe(first.transaction_id);
    expect(await scalar("select status as value from public.journal_entries where id=$1", [first.journal_id])).toBe('POSTED');
    expect(await scalar('select count(*)::int as value from public.journal_lines where journal_entry_id=$1', [first.journal_id])).toBe(2);
    await expect(db.query("update public.journal_entries set description='tampered' where id=$1", [first.journal_id])).rejects.toThrow(/immutable/);
  });
  it('isolates identical idempotency keys between businesses and rejects unauthorized lookup/post', async () => {
    await asUser(userB);
    expect((await post(businessB, 'same-key', accountB, cashB)).status).toBe('POSTED');
    expect(await scalar("select public.get_accounting_idempotency($1,'same-key') as value", [businessA])).toBeNull();
    await expect(post(businessA, 'forbidden', accountA, cashA)).rejects.toThrow(/Business access denied/);
    await db.exec('set role anon');
    await expect(scalar("select public.get_accounting_idempotency($1,'same-key') as value", [businessA])).rejects.toThrow(/permission denied/);
  });
  it('rejects foreign financial accounts in lines and rolls back the entire posting', async () => {
    await asUser(userA);
    await expect(post(businessA, 'bad-line', accountA, cashA, cashB)).rejects.toThrow(/financial account does not belong/);
    expect(await scalar("select count(*)::int as value from public.transactions where transaction_no='bad-line'")).toBe(0);
    expect(await scalar("select public.get_accounting_idempotency($1,'bad-line') as value", [businessA])).toBeNull();
  });
  it('rejects foreign transaction accounts and missing idempotency keys', async () => {
    await asUser(userA);
    await expect(post(businessA, 'foreign-account', accountB, cashA)).rejects.toThrow(/Account does not belong/);
    await expect(post(businessA, '', accountA, cashA)).rejects.toThrow(/Idempotency key is required/);
    await expect(post(businessA, null as any, accountA, cashA)).rejects.toThrow(/Idempotency key is required/);
    await asUser('');
    await expect(post(businessA, 'no-user', accountA, cashA)).rejects.toThrow(/Authentication required/);
    expect(await scalar("select public.get_accounting_idempotency($1,'same-key') as value", [businessA])).toBeNull();
  });
  it('rejects direct foreign COA mapping even for a user belonging to both businesses', async () => {
    await db.exec('reset role');
    await db.query("insert into public.business_members(business_id,user_id,role) values ($1,$2,'OWNER')", [businessB, userA]);
    await asUser(userA);
    await expect(db.query('update public.financial_accounts set account_id=$1 where id=$2', [accountB, cashA])).rejects.toThrow(/COA mapping does not belong/);
    const journal = await scalar("insert into public.journal_entries(business_id,journal_no,journal_date) values ($1,'direct','2026-10-19') returning id as value", [businessA]);
    await expect(db.query('insert into public.journal_lines(journal_entry_id,account_id,debit) values ($1,$2,10)', [journal, accountB])).rejects.toThrow(/account does not belong/);
  });
});


describe.sequential('upload and reconciliation against the authoritative schema', () => {
  it('persists a CSV statement and UUID bank rows and reads the reconciliation snapshot', async () => {
    await db.exec('reset role');
    await db.query("update financial_accounts set account_number='001235' where id=$1", [cashA]);
    const client = workflowClient(db, businessA);
    const before = await scalar('select count(*)::int as value from bank_statements');
    await expect(persistBankStatementImport(client,userA,businessA,'wrong.csv','Account Number,3450\nDate,Description,Debit,Credit\n2026-10-29,UAT,,25.00','text/csv',cashA)).rejects.toThrow('Wrong account uploaded');
    expect(await scalar('select count(*)::int as value from bank_statements')).toBe(before);
    const saved = await persistBankStatementImport(client, userA, businessA, 'statement.csv',
      'Account Number,001235\nDate,Description,Reference,Debit,Credit,Balance\n2026-10-19,Customer payment,INV-1,,25.00,25.00', 'text/csv', cashA);
    expect(saved.rows[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await scalar('select count(*)::int as value from bank_transactions where bank_statement_id=$1', [saved.statementId])).toBe(1);
    const snapshot = await getReconciliationSnapshot(client, businessA);
    expect(snapshot.statements.some(row => row.id === saved.statementId)).toBe(true);
    expect(snapshot.bankTransactions.some(row => row.id === saved.rows[0].id)).toBe(true);
    expect(snapshot.matches).toBeInstanceOf(Array);
    const revenue = await scalar("insert into accounts(business_id,code,name,account_type,normal_balance) values ($1,'4001','Sales','REVENUE','CREDIT') returning id as value", [businessA]);
    await asUser(userA);
    const approved = await postApprovedBankImport(client, userA, businessA, saved.statementId, revenue, 'MONEY_IN');
    expect(approved.summary.postedCount).toBe(1);
    await postApprovedBankImport(client, userA, businessA, saved.statementId, revenue, 'MONEY_IN');
    expect(await scalar("select count(*)::int as value from transactions where business_id=$1 and reference_no='INV-1'", [businessA])).toBe(1);
    const booked = await scalar("select id as value from transactions where business_id=$1 and reference_no='INV-1'", [businessA]);
    await createReconciliationMatch(client, userA, businessA, saved.rows[0].id, booked, '25.00');
    expect((await completeReconciliation(client, userA, businessA, saved.statementId)).status).toBe('COMPLETED');
  });
  it('rejects a different business before even consulting local memberships', async () => {
    const client = workflowClient(db, businessA);
    await expect(assertBusinessMembership(client, userA, businessB)).rejects.toThrow('Business access denied');
  });
});
