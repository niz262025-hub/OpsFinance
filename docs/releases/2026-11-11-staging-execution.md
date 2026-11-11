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
