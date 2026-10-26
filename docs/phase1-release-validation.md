# Phase 1 reconciliation — 2026-10-26

Reconcile PR #10 with main 565cca5586de3180273c29dfb9d614445c29ef87. Preserve newer dependencies, login protection, upload validation, disabled payments and migration history. The old 57e1f05 snapshot cannot be merged wholesale because it predates these changes and has conflicting migration numbers.

Port remaining tenant-scoped update, transaction insert and journal insert protections. Preserve newer journal payload validation. Main migration 013 already restricts idempotency reads. Add journal-line ownership enforcement as migration 016, avoiding 014 used by open SSO work. Historical migrations are unchanged.

Validation:
- Vitest: 202 passed, 1 live-Supabase test skipped.
- PGlite migration replay and tenant isolation passed, including cross-business journal account and financial-account writes with RLS bypass and preservation after rejection.
- TypeScript, lint and production build passed using existing installed dependencies. CI must verify clean npm ci.
- Corrected three stale tests that expected hosted preview authentication bypass. Added hosted preview/production demo-data denial assertions; authentication implementation is unchanged.
- Local Chromium download failed. Browser tests are not claimed passed. CI installs Chromium and runs two public release smoke tests.

Release blockers: live Supabase staging credentials, authenticated browser UAT, CI and remote migration-ledger verification. No remote SQL or production deployment performed. Legacy createPosted still uses multiple requests and can leave an unposted draft on failure; it is not atomic. Production transaction routes use post_accounting_transaction_atomic, requiring hosted rollback/concurrency UAT. SSO remains separate.
