import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import {
  SupabaseAccountRepository,
  SupabaseAccountingPeriodRepository,
  SupabaseBusinessRepository,
  SupabaseFinancialAccountRepository,
  SupabaseJournalRepository,
  SupabaseMembershipRepository,
} from '../packages/supabase-persistence';

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const appSuite = supabaseUrl && supabaseAnonKey && supabaseServiceRoleKey ? describe : describe.skip;

appSuite('real supabase accounting persistence', () => {
  it('persists a real business, accounts, journal, ledger, and report data in Supabase', async () => {
    const admin = createClient(supabaseUrl!, supabaseServiceRoleKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const userAEmail = `uat-user-${crypto.randomUUID()}@example.com`;
    const userAPassword = 'ChangeMe123!';
    const userBEmail = `uat-user-b-${crypto.randomUUID()}@example.com`;
    const userBPassword = 'ChangeMe123!';

    const userA = await admin.auth.admin.createUser({
      email: userAEmail,
      password: userAPassword,
      email_confirm: true,
      user_metadata: { name: 'UAT User A' },
    });
    const userB = await admin.auth.admin.createUser({
      email: userBEmail,
      password: userBPassword,
      email_confirm: true,
      user_metadata: { name: 'UAT User B' },
    });

    expect(userA.error).toBeNull();
    expect(userB.error).toBeNull();

    const businessRepo = new SupabaseBusinessRepository(admin);
    const membershipRepo = new SupabaseMembershipRepository(admin);
    const accountRepo = new SupabaseAccountRepository(admin);
    const financialRepo = new SupabaseFinancialAccountRepository(admin);
    const journalRepo = new SupabaseJournalRepository(admin);
    const periodRepo = new SupabaseAccountingPeriodRepository(admin);

    const businessA = await businessRepo.create(userA.data.user!.id, {
      name: 'UAT Business A',
      baseCurrency: 'MYR',
      email: userAEmail,
    });
    const businessB = await businessRepo.create(userB.data.user!.id, {
      name: 'UAT Business B',
      baseCurrency: 'MYR',
      email: userBEmail,
    });

    await membershipRepo.ensureOwner(userA.data.user!.id, businessA.id);
    await membershipRepo.ensureOwner(userB.data.user!.id, businessB.id);

    const persistedBusinessA = await businessRepo.getForUser(userA.data.user!.id, businessA.id);
    expect(persistedBusinessA.name).toBe('UAT Business A');

    const defaultAccounts = await accountRepo.ensureDefaultAccounts(businessA.id);
    const maybankAccount = defaultAccounts.find((row) => row.code === '1110');
    const salesAccount = defaultAccounts.find((row) => row.code === '4100');
    const rentalAccount = defaultAccounts.find((row) => row.code === '6100');

    expect(maybankAccount).toBeTruthy();
    expect(salesAccount).toBeTruthy();
    expect(rentalAccount).toBeTruthy();

    if (!maybankAccount || !salesAccount || !rentalAccount) {
      throw new Error('Required default UAT accounts were not created.');
    }

    const financialAccount = await financialRepo.upsertByCode(businessA.id, {
      id: crypto.randomUUID(),
      name: 'Maybank',
      type: 'BANK',
      accountCode: '1110',
      currency: 'MYR',
      status: 'ACTIVE',
      openingBalance: '0.00',
    });

    await periodRepo.upsertByName(businessA.id, {
      id: crypto.randomUUID(),
      name: '2026-10',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      status: 'OPEN',
      closedAt: null,
      closedBy: null,
    });

    const salesJournalId = crypto.randomUUID();
    const salesJournal = await journalRepo.createPosted({
      id: salesJournalId,
      businessId: businessA.id,
      journalNo: 'J-1001',
      journalDate: '2026-10-05',
      sourceType: 'MANUAL',
      description: 'UAT Sales',
      status: 'POSTED',
      postedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      referenceNo: 'INV-1001',
      lines: [
        {
          id: crypto.randomUUID(),
          journalEntryId: salesJournalId,
          accountId: maybankAccount.id,
          debit: '100.00',
          credit: '0.00',
          description: 'UAT Sales',
          financialAccountId: financialAccount.id,
        },
        {
          id: crypto.randomUUID(),
          journalEntryId: salesJournalId,
          accountId: salesAccount.id,
          debit: '0.00',
          credit: '100.00',
          description: 'UAT Sales',
          financialAccountId: undefined,
        },
      ],
    });

    const salesTrial = await journalRepo.getTrialBalance(businessA.id);
    expect(Number(salesTrial.totalDebit)).toBe(100);
    expect(Number(salesTrial.totalCredit)).toBe(100);
    expect(salesJournal.lines.length).toBe(2);

    const rentalJournalId = crypto.randomUUID();
    await journalRepo.createPosted({
      id: rentalJournalId,
      businessId: businessA.id,
      journalNo: 'J-1002',
      journalDate: '2026-10-06',
      sourceType: 'MANUAL',
      description: 'UAT Rental',
      status: 'POSTED',
      postedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      referenceNo: 'BILL-1002',
      lines: [
        {
          id: crypto.randomUUID(),
          journalEntryId: rentalJournalId,
          accountId: rentalAccount.id,
          debit: '30.00',
          credit: '0.00',
          description: 'UAT Rental',
          financialAccountId: undefined,
        },
        {
          id: crypto.randomUUID(),
          journalEntryId: rentalJournalId,
          accountId: maybankAccount.id,
          debit: '0.00',
          credit: '30.00',
          description: 'UAT Rental',
          financialAccountId: financialAccount.id,
        },
      ],
    });

    const ledger = await journalRepo.getLedger(businessA.id);
    const balanceMap = new Map<string, number>();
    for (const row of ledger) {
      const current = balanceMap.get(row.account_id) ?? 0;
      balanceMap.set(row.account_id, current + Number(row.debit ?? 0) - Number(row.credit ?? 0));
    }

    expect(balanceMap.get(maybankAccount.id)).toBe(70);
    expect(balanceMap.get(salesAccount.id)).toBe(-100);
    expect(balanceMap.get(rentalAccount.id)).toBe(30);

    const userAClient = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const userASignIn = await userAClient.auth.signInWithPassword({
      email: userAEmail,
      password: userAPassword,
    });
    expect(userASignIn.error).toBeNull();

    const userAViewBusinessA = await userAClient.from('businesses').select('*').eq('id', businessA.id);
    const userAViewBusinessB = await userAClient.from('businesses').select('*').eq('id', businessB.id);
    expect(userAViewBusinessA.data).toHaveLength(1);
    expect(userAViewBusinessB.data).toHaveLength(0);

    const userBClient = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const userBSignIn = await userBClient.auth.signInWithPassword({
      email: userBEmail,
      password: userBPassword,
    });
    expect(userBSignIn.error).toBeNull();

    const userBViewBusinessA = await userBClient.from('businesses').select('*').eq('id', businessA.id);
    const userBViewBusinessB = await userBClient.from('businesses').select('*').eq('id', businessB.id);
    expect(userBViewBusinessA.data).toHaveLength(0);
    expect(userBViewBusinessB.data).toHaveLength(1);

    const reloadedTrial = await journalRepo.getTrialBalance(businessA.id);
    expect(Number(reloadedTrial.totalDebit)).toBe(130);
    expect(Number(reloadedTrial.totalCredit)).toBe(130);
  }, 20000);
});
