# Staging execution — 11 November 2026

This supersedes the earlier access-blocked note. Both staging refs are development branches, discovered with `list_branches`; direct SQL access works. They are not listed as independent top-level projects.

- Central: `wengxxiqwtosirealghx`, branch `myops-sso-validation`, parent `uhuukcztdifvpjuopdea`.
- Finance: `tfwizcztyktdurmiynzs`, branch `myops-sso-validation`, parent `ozkjsihuovzpujuabupa`.
- Captured the previous Finance provisioning RPC definition and grants in the adjacent rollback SQL before applying the compatibility migration.
- Applied `finance_myops_provisioning_auth_trigger_compatibility` to Finance staging only. Verified SECURITY INVOKER; EXECUTE denied to anon/authenticated and allowed to service_role; all public table RLS remains enabled. Four existing identity mappings remain.
- Live staging database test PASS: pre-created auth-sync profile accepted, isolated OWNER membership created, repeat call returns the same mapping. All fixture writes were inside a rolled-back transaction; no persistent test identity remains.
- Signed transport probe using an intentionally nonexistent ticket reached central nonce registration at 11:23:38 UTC. Its HTTP 401 is expected for an invalid ticket; it does not establish a signature or Vercel-protection failure. Real authenticated launch UAT remains outstanding.
- Integrated the coordinated release candidate into the existing staging source while preserving sanitized staging diagnostics. Finance: 342 tests passed, one skipped; lint, typecheck and production build passed. MYOPS integration: 211 tests passed, 36 skipped; lint/build passed, including preserved TAC verification and resend regressions.

Production database and deployments remain unchanged by this staging execution. No charges were created. Authenticated browser UAT and production backup/recovery verification remain release gates.

## Follow-up permission verification

Live staging inspection found that the business-profile owner/admin UPDATE policy existed, but authenticated UPDATE grants were missing. Both Business Profile and Accounting Settings submit editable fields plus updated_at through the tenant-scoped client. Production already permits these updates; this particular save blocker was staging configuration drift.

Applied `finance_business_profile_permissions` on Finance staging after capturing the previous grants in `2026-11-11-staging-permissions-rollback.sql`. The migration grants UPDATE on the eight submitted profile fields only, leaving id and created_at uneditable. It also revokes historical TRUNCATE, REFERENCES and TRIGGER table grants from PUBLIC/anon/authenticated; these schema privileges are not needed by browser users. Existing RLS and the restrictive broker remain active. Production inspection still has 18 tables with excess browser grants; the migration has not been applied there.

PASS on live staging in a rolled-back transaction: owner reads and saves their own profile; other-tenant reads and updates return no rows; missing/wrong broker credentials return no business rows. Verified zero leftover fixtures, four original mappings, broker enabled, and zero excess browser table grants after the migration. Repository migration replay and tenant/broker isolation suite also passed with new profile-save and schema-privilege regression assertions.

The release PR was aligned to the tested staging source. No production deployment occurred. Browser session inspection found no retained signed-in tab, so real login, fresh launch-ticket redemption, dashboard navigation, logout and expiry UAT remain unverified.

## Authenticated browser verification — 11 November 2026, 16:34–16:43 UTC

This supersedes the earlier missing-browser-session blocker for the MYOPS–Finance staging pair. Tested Finance source c94d832343839aac2d74195fda41e404b5695225 with MYOPS staging source 5235f6a63184ffd01121c113b82f5c3f2d73e3ff.

| Check | Result and scope |
| --- | --- |
| Central identity | PASS: signed in as niz262001@gmail.com; My Account and Admin rendered. |
| Admin audit | PASS: server-authorized dashboard loaded sandbox payment/income records. |
| Fresh SSO launch | PASS: MYOPS Open App → Finance /launch → /dashboard, without a second login or checkout. |
| Business mapping | PASS for the existing staging mapping: dashboard used SSO Staging Fixture; database confirms its enabled identity mapping and OWNER membership. This is an existing UAT fixture, not a customer business. |
| Refresh | PASS: dashboard retained the authenticated business context and loaded financial data after reload. |
| Read navigation | PASS: Financial Accounts, Chart of Accounts and Transactions loaded fixture rows. |
| Fixture calculation | PASS: P&L for 2026-10-01 through 2026-10-31 showed revenue RM125, expenses RM40, net profit RM85, matching dashboard. This does not replace the full accounting UAT. |
| Upload/reconciliation | Pages opened through SSO. No upload, posting or reconciliation completion was executed in this browser run. |
| Idle expiry | PASS, simulated server clock state: moved only this staging user's Finance app-session last_activity_at back 16 minutes; next protected navigation redirected to central /login. Database recorded idle_expired. Did not wait 15 minutes naturally. |
| Relaunch | PASS: existing central login issued a fresh app ticket and opened a new Finance dashboard session after app-session expiry. |
| Central logout | PASS: clicked MYOPS Log keluar semua aplikasi; central UI became signed out, reloading the open Finance dashboard redirected to central /login; database recorded myops_logout on the new app session. |

Database evidence: app session 5b408746-90c0-423d-a7c9-fa091291b39d ended idle_expired; subsequent session 279238d9-e285-4782-8b18-5302321322c0 ended myops_logout. No production session or customer data was modified. No new payment or accounting posting was created.

The account has three existing staging subscription rows, so this browser run alone does not independently prove the no-subscription admin exemption. Server-side admin policy/unit coverage remains separate. Production migration/backup recovery checks, fresh unmapped-user browser provisioning, full accounting workflows, payment sandbox lifecycle and production smoke tests remain release gates.

CI evidence: https://github.com/niz262025-hub/OpsFinance/actions/runs/43057236797 — 342 unit tests passed, one skipped; database/typecheck/lint/build PASS; 8 signed-out public browser tests PASS across desktop, Pixel 5, iPhone 12 WebKit and tablet emulation.

Screenshot: ../uat-evidence/2026-11-11/myops-finance-sso-staging.png. Production release remains HOLD.
