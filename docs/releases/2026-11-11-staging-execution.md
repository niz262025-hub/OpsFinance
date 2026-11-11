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
