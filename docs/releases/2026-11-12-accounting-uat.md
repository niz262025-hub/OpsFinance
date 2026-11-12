# Accounting UAT checkpoint — 12 November 2026

## Production read-only verification

Fresh MYOPS login and Open OpsFinance launch reached app.myops.com.my/dashboard without a second login. Opened /transactions/journal directly after the dashboard quick-action link did not navigate. Data loaded, UAT Cash appeared, and selecting it succeeded. Initial empty dropdown was a loading state; the earlier account-creation prerequisite was confirmed in the database. No production posting was performed.

Database read-only evidence: UAT Cash ACTIVE, opening balance 0, mapped to active ledger 1099 UAT Test Cash in business MYOPS. That business had zero transactions and zero journal entries at inspection. Existing identity mapping enabled and membership OWNER. This business is not designated an isolated UAT business; do not write test transactions into it.

## Verified defects and changes

- Transaction form fetched accounts only on mount. Refresh on window focus now picks up accounts created in another tab.
- Browser POST lacked a stable idempotency key. Unchanged-input retries now preserve the same random key; successful or changed-input entries use a new key.
- Journal Entry reused the cash outflow form and had no debit/credit controls. API required a financial account and otherwise auto-generated cash outflow lines. General journals now have explicit 2–100 debit/credit lines and do not require a financial account. The existing page shell and styling are retained.
- General journal API validates date, description, key, integer-cent balance and active account membership before invoking the existing atomic posting RPC with the authenticated RLS client. Unauthorized requested businesses return 403 rather than an uncaught exception.

No production schema, data, security configuration or subscription checkout changes were made in this round.

## Executed checks

Lint, typecheck and optimized production build passed. Unit/integration suite before the final database assertion: 359 passed, 1 skipped. PostgreSQL migration-replay/isolation script passed. Additional PostgreSQL test run: 14 passed, including a balanced general journal with no financial account, duplicate retry returning one transaction, balanced posted lines and one audit entry, all rolled back in local PGlite. This is local database evidence, not remote staging or production browser UAT.

## Remaining release gates

| Module | Status | Remaining evidence |
| --- | --- | --- |
| Central login/dashboard | PASS | Fresh production browser launch observed |
| Financial-account dropdown | PASS | UAT Cash loaded and selected in existing production form |
| COA CRUD and financial mapping | PARTIAL | User-reported creation plus read-only database confirmation; remaining CRUD/validation browser UAT pending |
| General journal | PENDING | Local validator/API/UI and PostgreSQL tests pass; staging browser posting/regression pending |
| Money In / Money Out / Transfer | PENDING | Controlled browser transactions in isolated UAT business |
| GL / Trial Balance / P&L / Balance Sheet / Cash Flow | PENDING | Browser report checks against controlled posted transactions |
| Upload / Reconciliation / Duplicate detection | PENDING | Full staging browser workflow; local coverage is separate |
| Period locking | PENDING | Real database enforcement and UI workflow need verification |
| Audit trail / Tenant isolation | PARTIAL | Local PostgreSQL assertions pass; deployed authenticated regression pending |
| Production release | HOLD | No new production release until staging acceptance passes |
