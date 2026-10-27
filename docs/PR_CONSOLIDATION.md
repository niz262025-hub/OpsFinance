# Reviewed PR consolidation and release hold

PRs #4–9 are superseded by the current #19 integration. Upload/reconciliation use authenticated API/database operations; accounting retries use the existing atomic RPC. The integration preserves current SSO, tenant-write hardening, branding, dependencies and applied migration history. The old conflicting migration snapshots are deliberately not imported.

The #4 billing hydration issue is superseded by the already-disabled subscription UI. #6 standalone billing removal is represented by disabled payment routes/navigation; inert compatibility models remain until the central release is verified. #7 demo safety is superseded by the stricter local-development-only bypass with hosted denial tests. #9 direct repository idempotency access is disabled while the existing tenant-protected SQL/ACL model is preserved.

Executed: 255 tests passed, one live persistence test skipped; database migration replay, tenant/broker/ACL tests, TypeScript, lint and production build passed locally. A new PostgreSQL-schema integration executes CSV persistence, atomic posting, idempotent retry, reconciliation match and completion. This is local integration evidence, not a live hosted test.

Vercel automatic deployment of main is disabled in vercel.json so merging reviewed code cannot implicitly release it. Other branches remain eligible for Preview. Do not remove the hold or deploy manually until authenticated MYOPS→Finance E2E, entitlement denial/revocation, Storage/direct API enforcement, concurrency and tenant UAT pass and production authorization is confirmed. Supabase changes remain unapplied by this consolidation.
