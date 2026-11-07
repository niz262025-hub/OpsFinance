// Synthetic CPU/heap-work benchmark; no database, browser session or network.
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { AccountingEngine } = require('../packages/accounting.ts');
const { FinancialReportService } = require('../packages/reports.ts');
const businessId = 'synthetic-dashboard';
const types = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
const accounts = Array.from({ length: 200 }, (_, i) => ({ id: `a-${i}`, businessId, code: String(i), name: `Account ${i}`, accountType: types[i % types.length], normalBalance: i % 2 ? 'CREDIT' : 'DEBIT', isActive: true }));
const journals = Array.from({ length: 10000 }, (_, i) => ({ id: `j-${i}`, businessId, journalNo: `J-${i}`, journalDate: `2026-10-${String(1 + i % 28).padStart(2, '0')}`, status: 'POSTED', sourceType: 'MANUAL', lines: [
  { accountId: accounts[i % 200].id, debit: i % 4 ? '12.34' : '0.01', credit: '0.00' },
  { accountId: accounts[(i + 73) % 200].id, debit: '0.00', credit: i % 4 ? '12.34' : '0.01' },
] }));
let accountSnapshots = 0, journalSnapshots = 0;
const service = new FinancialReportService({ engine: new AccountingEngine({ businessId, accounts }), repository: {
  getBusinessAccounts: () => { accountSnapshots++; return accounts; },
  // Dashboard's repository materializes posted journal objects from downloaded rows.
  getPostedJournals: () => { journalSnapshots++; return journals.map(j => ({ ...j, lines: j.lines.map(line => ({ ...line })) })); },
} });
function measure(variant) {
  const samples = []; let digest, reads;
  for (let i = 0; i < 7; i++) {
    accountSnapshots = 0; journalSnapshots = 0;
    const start = performance.now();
    const rows = variant === 'before'
      ? accounts.map(account => ({ id: account.id, name: account.name, type: account.accountType, balance: service.getAccountStatement({ businessId, accountId: account.id }).closingBalance }))
      : service.getAccountBalances({ businessId }).map(row => ({ id: row.accountId, name: row.accountName, type: row.accountType, balance: row.closingBalance }));
    const elapsed = performance.now() - start;
    const hash = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
    if (digest && digest !== hash) throw new Error('Balance result changed between runs');
    digest = hash; reads = { accountSnapshots, journalSnapshots };
    if (i >= 2) samples.push(elapsed);
  }
  samples.sort((a,b) => a-b);
  return { medianMs: Number(samples[2].toFixed(3)), samplesMs: samples.map(n => Number(n.toFixed(3))), ...reads, resultSha256: digest };
}
const before = measure('before'), after = measure('after');
if (before.resultSha256 !== after.resultSha256) throw new Error('Before/after closing balances differ');
console.log(JSON.stringify({ fixture: 'synthetic CPU work for account balance rendering, not page load time', accounts: accounts.length, journals: journals.length, warmups: 2, timedSamples: 5, before, after }, null, 2));
