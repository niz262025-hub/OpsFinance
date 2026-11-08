# Step 4 — OpsFinance release candidate

Status: code and automated checks complete, ready for integrated release review. No production promotion or hosted database mutation.

Depends on OpsFinance PR #47 (`fix/step2-central-pricing-policy`). Merge the policy correction first, followed by this candidate at the planned merge stage.

## Confirmed defects fixed

- Trial account setup blocked the atomic `create_financial_account_with_ledger` RPC. Permit it only with the verified bound business and zero opening balance, through the original authenticated client. The SQL owner/admin, tenant, ledger and retry checks remain in force. Privileged quota adapters are not used to create bank accounts. Nonzero balances still require trial journal/quota support and remain rejected.
- Reports fetched one unpaginated journal page and used a query omitting tenant/source fields needed in its mapped snapshot. Read all accounts and posted journals through the authenticated tenant-filtered client, with deterministic ordering, required columns and explicit page failure handling. Reject foreign/malformed/duplicate rows rather than reporting partial totals.
- Report filters defaulted to October 2026 and financial account opening dates to September 2026. Use the current local month/date. Reject invalid/reversed report periods and disable export when no valid report exists.
- Report loads could settle after a tenant switch. Ignore obsolete requests and derive date/account selections from the current tenant snapshot. Date changes do not re-fetch the same complete snapshot; Refresh explicitly reloads it.
- Language selection changed shell navigation but left workflows in English. Added shared live locale subscriptions and fixed-copy dictionaries for English, Malay, Simplified Chinese and Tamil across dashboard, transactions, accounts/ledger, reports, uploads, reconciliation, profile and settings controls. Same-window changes update without reload, and blocked storage retains a working in-memory selection. Customer-entered values are not translated.
- Subscription settings advertised the old standalone/ungated billing model. Direct plan/trial/payment management to the MYOPS account instead.

## Automated verification

| Check | Result |
| --- | --- |
| Full test suite | 348 PASS / 1 environment-dependent SKIP / 0 FAIL |
| TypeScript | PASS |
| ESLint | PASS, no warnings |
| Next production build | PASS |
| Trial quota SQL fixture | PASS: 30/31 transactions, 2 statements, 5 documents, retries, expiry, failed-write rollback, browser denial |
| Database migration/isolation replay | PASS: owner access, cross-business read/write rejection, anonymous RPC denial, broker checks, import quota/rollback |
| Reports | PASS: all 1001 rows, later-page failure, correct selected account, current-month filters, invalid ranges, obsolete tenant request rejection |
| Bank/ledger | PASS: zero-balance bound trial RPC, blocked cross-business/nonzero requests, bank master API/UI, migration atomicity/tenant tests |
| Refund/reversal accounting | Existing signed P&L tests PASS, including full/partial reversal and negative net amounts |
| Four languages | All workflow dictionary entries complete; form switches through four locales and preserves names, account number leading zeros, currency and API enum values |

## Release gates still pending (later plan steps)

- Integrate the remaining MYOPS/OpsFlow/OpsPS/OpsHR candidates and their central session/trial contracts before merge/release.
- Desktop and phone browser UAT on the exact hosted release candidate, including real MYOPS SSO, save/reload and bank statement matching.
- Confirm required existing database migrations and role grants in the target environment. This change adds no migration and changes no hosted grant.
- Controlled signed-in live acceptance and central trial enablement remain pending. Test fixtures are not real customer or live database UAT.
- CSV/TXT bank statement support remains the approved scope; PDF/image/Excel extraction and advanced Accounting Rules UI are not newly implemented by this release candidate.

## React and security review

No conditional hooks, customer-data translation, permission cache, local login fallback, service key exposure or new paid dependency was added. Locale snapshots are stable strings; listeners clean up. Report reads are tenant-bound, stale effects are ignored, and failed pages do not expose incomplete exportable figures. The trial bank RPC preserves the existing SQL authorization boundary and cannot create an opening posting outside quota enforcement.

## Rollback

The current production deployment remains untouched. For a later promotion, record its exact domain deployment before release and retain it as rollback target. Reverting this candidate restores the prior application tree; no hosted schema rollback is required by these changes.
