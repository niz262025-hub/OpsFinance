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
let legacyPostedBankId: string;
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
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$; grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;`);
  const files = readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort();
  expect(new Set(files.map(f => f.split('_')[0])).size).toBe(files.length);
  for (const file of files) {
    if (file === '019_default_coa_and_atomic_bank_accounts.sql') {
      businessA = '20000000-0000-0000-0000-000000000001';
      await db.exec(`insert into public.users(id,email,name) values
        ('${userA}','a@example.test','A'),('${userB}','b@example.test','B');
        insert into public.businesses(id,name) values ('${businessA}','Legacy A');
        insert into public.business_members(business_id,user_id,role) values ('${businessA}','${userA}','OWNER');
        insert into public.accounts(business_id,code,name,account_type,normal_balance)
          values ('${businessA}','1000','Legacy Asset Root','ASSET','DEBIT');
        insert into public.accounts(business_id,code,name,account_type,parent_id,normal_balance)
          values ('${businessA}','1100','Legacy Cash','ASSET',
            (select id from public.accounts where business_id='${businessA}' and code='1000'),'DEBIT');
        insert into public.accounts(business_id,code,name,account_type,normal_balance)
          values ('${businessA}','4000','Legacy Revenue','REVENUE','CREDIT');
        insert into public.accounts(business_id,code,name,account_type,parent_id,normal_balance)
          values ('${businessA}','4100','Legacy Sales','REVENUE',
            (select id from public.accounts where business_id='${businessA}' and code='4000'),'CREDIT');
        insert into public.financial_accounts(business_id,name,type,account_code)
          values ('${businessA}','Legacy Bank','BANK','LEGACY-BANK'),
            ('${businessA}','Legacy Posted Bank','BANK','LEGACY-POSTED-BANK');`);
      legacyPostedBankId = await scalar("select id as value from public.financial_accounts where business_id=$1 and account_code='LEGACY-POSTED-BANK'", [businessA]);
      const legacyCashId = await scalar("select id as value from public.accounts where business_id=$1 and code='1100'", [businessA]);
      const legacyRevenueId = await scalar("select id as value from public.accounts where business_id=$1 and code='4100'", [businessA]);
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [userA]);
      await scalar(
        `select public.post_accounting_transaction_atomic(
          $1, 'legacy-history', 'MONEY_IN', '2026-10-19', 'Legacy opening activity',
          'LEGACY-HISTORY', 25, $2, $3, 'LEGACY-JOURNAL', 'Legacy opening activity', $4::jsonb
        ) as value`,
        [businessA, legacyPostedBankId, legacyRevenueId, JSON.stringify([
          { account_id: legacyCashId, financial_account_id: legacyPostedBankId, debit: 25, credit: 0 },
          { account_id: legacyRevenueId, debit: 0, credit: 25 },
        ])],
      );
    }
    const sql = readFileSync(`supabase/migrations/${file}`, 'utf8');
    try { await db.exec(sql); } catch (error) { throw new Error(`Migration ${file}: ${String(error)}`); }
  }
  await db.exec(`grant usage on schema public to authenticated, anon;
    grant select, insert, update, delete on all tables in schema public to authenticated;`);
  await asUser(userB);
  businessB = await scalar("select public.create_business_with_owner('B') as value");
  await db.exec('reset role');
  for (const business of [businessA, businessB]) {
    const account = await scalar("select id as value from public.accounts where business_id=$1 and code='1110'", [business]);
    const cash = await scalar("insert into public.financial_accounts(business_id,name,type,account_code,account_id) values ($1,'Cash','CASH','CASH',$2) returning id as value", [business, account]);
    if (business === businessA) { accountA = account; cashA = cash; } else { accountB = account; cashB = cash; }
  }
}, 60000);
afterAll(async () => { await db?.close(); });

describe.sequential('PostgreSQL migration replay and tenant A/B boundaries', () => {
  it('can reapply migration 019 without duplicates and roll back all migration effects transactionally', async () => {
    await db.exec('reset role');
    const accountCount = await scalar('select count(*)::int as value from public.accounts where business_id=$1', [businessA]);
    const financialAccountCount = await scalar('select count(*)::int as value from public.financial_accounts where business_id=$1', [businessA]);
    const migration = readFileSync('supabase/migrations/019_default_coa_and_atomic_bank_accounts.sql', 'utf8');

    await db.exec('begin');
    await db.exec(migration);
    expect(await scalar('select count(*)::int as value from public.accounts where business_id=$1', [businessA])).toBe(accountCount);
    expect(await scalar('select count(*)::int as value from public.financial_accounts where business_id=$1', [businessA])).toBe(financialAccountCount);

    const transientBusiness = '20000000-0000-0000-0000-000000000099';
    await db.query('insert into public.businesses(id,name) values ($1,$2)', [transientBusiness, 'Rollback check']);
    expect(await scalar('select count(*)::int as value from public.accounts where business_id=$1', [transientBusiness])).toBeGreaterThan(0);
    await db.exec('rollback');

    expect(await scalar('select count(*)::int as value from public.businesses where id=$1', [transientBusiness])).toBe(0);
    expect(await scalar('select count(*)::int as value from public.accounts where business_id=$1', [businessA])).toBe(accountCount);
    expect(await scalar('select count(*)::int as value from public.financial_accounts where business_id=$1', [businessA])).toBe(financialAccountCount);
  });
  it('backfills partial businesses without replacing existing account codes', async () => {
    await db.exec('reset role');
    expect(await scalar("select name as value from public.accounts where business_id=$1 and code='1000'", [businessA])).toBe('Legacy Asset Root');
    expect(await scalar("select name as value from public.accounts where business_id=$1 and code='1100'", [businessA])).toBe('Legacy Cash');
    expect(await scalar("select count(*)::int as value from public.accounts where business_id=$1 and name='Cash' and is_system", [businessA])).toBe(1);
    expect(await scalar("select count(*)::int as value from public.accounts where business_id=$1 and account_type='LIABILITY'", [businessA])).toBeGreaterThan(0);
    expect(await scalar("select count(*)::int as value from public.accounts where business_id=$1 and name='Accumulated Depreciation' and account_type='ASSET' and normal_balance='CREDIT'", [businessA])).toBe(1);
    expect(await scalar("select count(*)::int as value from public.financial_accounts where business_id=$1 and account_code='LEGACY-BANK' and account_id is not null", [businessA])).toBe(1);
    expect(await scalar("select count(*)::int as value from public.financial_accounts where id=$1 and account_id is null", [legacyPostedBankId])).toBe(1);
    expect(await scalar("select count(*)::int as value from public.journal_entries where business_id=$1", [businessA])).toBe(1);
  });
  it('seeds default COA groups and creates a bank ledger atomically and idempotently', async () => {
    await asUser(userA);
    for (const [code, type] of [['1000', 'ASSET'], ['2000', 'LIABILITY'], ['3000', 'EQUITY'], ['4000', 'REVENUE']] as const) {
      expect(await scalar('select count(*)::int as value from public.accounts where business_id=$1 and code=$2 and account_type=$3', [businessA, code, type])).toBe(1);
    }

    const createBank = () => scalar(
      `select public.create_financial_account_with_ledger(
        $1, 'Operating Bank', 'BANK'::public.financial_account_type_enum, 'OPERATING-BANK',
        'MYR', 'ACTIVE', 'Example Bank', 'Example Company', '001234', 0, '2026-10-19', null
      ) as value`,
      [businessA],
    );
    const first = await createBank();
    const retry = await createBank();
    expect(first.idempotent).toBe(false);
    expect(retry.idempotent).toBe(true);
    expect(retry.financialAccount.id).toBe(first.financialAccount.id);
    expect(await scalar('select count(*)::int as value from public.financial_accounts where business_id=$1 and account_code=$2', [businessA, 'OPERATING-BANK'])).toBe(1);
    expect(await scalar('select count(*)::int as value from public.accounts where id=$1 and business_id=$2 and account_type=$3', [first.financialAccount.account_id, businessA, 'ASSET'])).toBe(1);

    await expect(db.query(
      `select public.create_financial_account_with_ledger(
        $1, 'Second Bank', 'BANK'::public.financial_account_type_enum, 'SECOND-BANK',
        'MYR', 'ACTIVE', 'Example Bank', 'Example Company', '009999', 0, '2026-10-19', $2
      )`,
      [businessA, first.financialAccount.account_id],
    )).rejects.toThrow(/already linked/);
    await expect(db.query(
      `select public.create_financial_account_with_ledger(
        $1, 'Cross Tenant Bank', 'BANK'::public.financial_account_type_enum, 'CROSS-TENANT-BANK',
        'MYR', 'ACTIVE', 'Example Bank', 'Example Company', '008888', 0, '2026-10-19', $2
      )`,
      [businessA, accountB],
    )).rejects.toThrow(/this business/);
    expect(await scalar('select count(*)::int as value from public.financial_accounts where business_id=$1 and account_code in ($2,$3)', [businessA, 'SECOND-BANK', 'CROSS-TENANT-BANK'])).toBe(0);
  });
  it('posts a bank opening balance in the same creation transaction as a balanced journal', async () => {
    await asUser(userA);
    const result = await scalar(
      `select public.create_financial_account_with_ledger(
        $1, 'Opening Balance Bank', 'BANK'::public.financial_account_type_enum, 'OPENING-BANK',
        'MYR', 'ACTIVE', 'Example Bank', 'Example Company', '009876', 125.50, '2026-10-20', null
      ) as value`,
      [businessA],
    );
    expect(result.openingJournal.status).toBe('POSTED');
    expect(await scalar(
      `select (sum(jl.debit) = sum(jl.credit)) as value
       from public.journal_lines jl
       join public.journal_entries je on je.id=jl.journal_entry_id
       where je.id=$1`,
      [result.openingJournal.journal_id],
    )).toBe(true);
    expect(await scalar('select count(*)::int as value from public.journal_lines where journal_entry_id=$1', [result.openingJournal.journal_id])).toBe(2);
    const alternateLedger = await scalar("select id as value from public.accounts where business_id=$1 and code='1110'", [businessA]);
    await expect(db.query('update public.financial_accounts set account_id=$1 where id=$2', [alternateLedger, result.financialAccount.id]))
      .rejects.toThrow(/posted journal activity/);
    await expect(db.query('update public.financial_accounts set opening_balance=200 where id=$1', [result.financialAccount.id]))
      .rejects.toThrow(/balanced posted journal entry/);
    await expect(db.query(
      `insert into public.financial_accounts(business_id,name,type,account_code,opening_balance,account_id)
       values ($1,'Unjournaled','CASH','UNJOURNALED',10,$2)`,
      [businessA, alternateLedger],
    )).rejects.toThrow(/balanced posted journal entry/);
  });
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
