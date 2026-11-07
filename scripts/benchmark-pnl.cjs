// Synthetic CPU benchmark only; no network, credentials or customer records.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { createHash } = require('node:crypto');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const filename = path.resolve(__dirname, '../packages/reports.ts');
const source = fs.readFileSync(process.argv[2] || filename, 'utf8');
const compiled = new Module(filename, module);
compiled.filename = filename;
compiled.paths = Module._nodeModulePaths(path.dirname(filename));
compiled._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { FinancialReportService } = compiled.exports;
const { AccountingEngine } = require('../packages/accounting.ts');
const businessId = 'benchmark-only';
const accounts = Array.from({ length: 200 }, (_, index) => ({ id: `account-${index}`, businessId, code: String(index), name: `Account ${index}`, accountType: index % 3 === 0 ? 'REVENUE' : index % 3 === 1 ? 'COGS' : 'EXPENSE', normalBalance: index % 3 === 0 ? 'CREDIT' : 'DEBIT', isActive: true }));
const journals = Array.from({ length: 10000 }, (_, index) => ({ id: `journal-${index}`, businessId, journalNo: `J${index}`, journalDate: '2026-10-15', status: 'POSTED', sourceType: 'MANUAL', lines: [{ accountId: accounts[index % accounts.length].id, debit: index % 4 ? '12.34' : '0.00', credit: index % 4 ? '0.00' : '12.34' }] }));
const service = new FinancialReportService({ engine: new AccountingEngine({ businessId, accounts }), repository: { getBusinessAccounts: () => accounts, getPostedJournals: () => journals } });
const times = [];
let result;
for (let iteration = 0; iteration < 10; iteration++) {
  const start = performance.now();
  result = service.getProfitAndLoss({ businessId, dateFrom: '2026-10-01', dateTo: '2026-10-31' });
  if (iteration >= 3) times.push(performance.now() - start);
}
times.sort((a, b) => a - b);
console.log(JSON.stringify({ accounts: accounts.length, journals: journals.length, warmups: 3, samples: times.length, medianMs: Number(times[3].toFixed(3)), resultSha256: createHash('sha256').update(JSON.stringify(result)).digest('hex'), revenueTotal: result.revenueTotal, cogsTotal: result.cogsTotal, expensesTotal: result.expensesTotal, netProfit: result.netProfit }));
