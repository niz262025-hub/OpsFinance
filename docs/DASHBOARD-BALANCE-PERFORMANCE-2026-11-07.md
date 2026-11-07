# Finance dashboard balance calculation — 7 November 2026

Status: implementation and automated regression checks PASS; real signed-in dashboard/route UAT remains BLOCKED. Production release is not approved by this report.

## Confirmed repeated work and repair

The dashboard previously called getAccountStatement separately for each account and retained only its closing balance. Each call materialized a posted-journal snapshot, filtered/sorted journals and built statement transaction rows that the dashboard discarded. The dashboard's downloaded journal data was already the same for every call.

FinancialReportService now exposes getAccountBalances for all-time posted balances. It authorizes the requested business, reads one account/journal snapshot, excludes foreign business rows and unposted journals, accumulates signed DecimalMoney impacts by account ID, and preserves account order, names, types and zero balances. The dashboard uses these summaries directly. Existing statement/report routes and date-filtered statement semantics are unchanged.

All maps exist within the method invocation. There is no financial-data or authorization cache between calls, no new network service, no schema/index/migration and no customer-data write. The earlier parallel fresh SSO checks and existing trial enforcement are retained.

## Reproducible CPU evidence

Run node scripts/benchmark-dashboard-balances.cjs. This uses 200 synthetic accounts and 10,000 balanced journals with varied dates, two warmups and five timed samples per variant in the same Node process. The before path invokes the unchanged original getAccountStatement API for every account; the after path invokes getAccountBalances. Both materialize journal objects from the same in-memory downloaded-row fixture. No browser session, database or network is involved.

| Measure | Before | After |
| --- | ---: | ---: |
| Median CPU calculation | 641.040ms | 13.882ms |
| Account snapshot reads per calculation | 400 | 1 |
| Journal snapshot materializations per calculation | 200 | 1 |
| Complete displayed-balance result SHA-256 | f3cd60aa0579f9a07a1e27ce5c2a8140eb3ed6b89d60332372ae9ec4d7a25d32 | Same |

This is approximately 97.8% less CPU time for this balance-rendering fixture, not a 97.8% website speedup. Snapshot reads above are in-memory repository calls, not Supabase queries. Network request count and downloaded-journal pagination are unchanged. Dashboard under 2 seconds and transitions under 1 second are not yet claimed.

## Automated verification

- New financial equivalence checks: original statement closing balances match every bulk summary, including opening entries, refunds, credit-normal assets and zero accounts.
- New isolation checks: another requested business is denied before repository access; foreign accounts/journals and draft journals are excluded even from a mis-scoped repository.
- New precision/freshness check: exact cents beyond floating-point precision; a second invocation reads newly added journals rather than cached totals.
- Targeted balance/dashboard/report regression: 30 PASS.
- Full isolated staging suite: 312 PASS, 1 environment-dependent database SKIP, zero failures.
- Full release-branch suite: 326 PASS, 1 environment-dependent database SKIP, zero failures.
- TypeScript and Vercel build states are recorded after verification below. Counts describe distinct source bases and are not added together.

## Browser and release gate

The previous browser tab no longer existed after inactivity. A fresh central UAT /account initially loaded its shell and then redirected to /login. There is no verified signed-in browser session for actual dashboard speed measurement. No credential request, fabricated session, auth bypass, production promotion or subscription change was made in this continuation.

Next acceptance: compare actual cold/warm authenticated dashboard usable times and screen transitions on the same device/network with five samples each. Reconcile RM85 cash / RM125 revenue / RM40 expenses / RM85 profit and bank/cash ledgers RM45/RM40, recent transaction values and existing report balances. Then perform mobile and negative-access checks. Keep PR 37 draft until the outstanding UAT and broader approved repairs pass.

Rollback: revert the balance optimization or restore the preceding isolated preview source cdf52925fbe74c704713914d9ef2b24a149b7a50 (deployment dpl_73S6aYS1bfLKeFxxCJiA3Ywy2qs8). This retains the earlier SSO-performance repair. No data or migration rollback is required.

## Built source and evidence

| Candidate | Source | Deployment | Build |
| --- | --- | --- | --- |
| Isolated UAT | 7d01eeaa52f894bef5fb99afbda92e3e939d1d11 | dpl_F2M7sAyhyYnXsKT6H5r6Bs6rQAfx — https://opsfinance-2ed0erm3i-mohd-syaiful-nizam1.vercel.app | READY, preview |
| PR implementation | 83f4562133d28347efaa9b1122b9a56ab4ff34db | dpl_BR4otLUn4PZwUVpssARqDQKxCYS7 — https://opsfinance-d8rhwd69s-mohd-syaiful-nizam1.vercel.app | READY, preview |

Both worktree TypeScript checks passed. [Benchmark output](./uat-evidence/dashboard-balance-benchmark-2026-11-07.json), [release regression log](./uat-evidence/dashboard-balance-release-full-2026-11-07.log), [staging regression log](./uat-evidence/dashboard-balance-staging-full-2026-11-07.log). No migration or production alias was changed.
