# MYOPS ↔ OpsFinance identity-binding production readiness gate

**Owner clarified on 2026-10-27: use the existing OpsFinance Supabase project as the intended PRODUCTION target. No schema, data, or Auth mutation has been authorized by this document; protect live users and prepare a reviewed rollout first.**

Supabase project discovery on 2026-10-27 showed:
- MYOPS-Central-Auth: `uhuukcztdifvpjuopdea`
- OpsFinance: `ozkjsihuovzpujuabupa`
- No separate OpsFinance staging project was returned. Owner selected the OpsFinance project as production target.

The latest owner direction selects `ozkjsihuovzpujuabupa` as PRODUCTION. Earlier production-readiness authorization is superseded for target selection, but does not justify an unreviewed live schema or Auth change.

## Proposed identity model (not applied)

1. Create a private, service-role-only `myops_identity_links` table in a approved OpsFinance **production** Supabase project. Store a unique app-scoped `user_ref` from MYOPS (not the raw MYOPS auth UID), the target OpsFinance Auth user UUID, authorized business UUID, disabled/revoked state, creation and review timestamps.
2. Enforce uniqueness on `user_ref` and on intended (user,business) bindings. Restrict direct access from `anon` and `authenticated` entirely. No client-exposed writes. Prefer non-exposed schema with explicit restrictions and RLS as defense-in-depth.
3. Provision bindings only through verified admin action involving both systems and an existing verified Supabase Auth user. Do **not** auto-link on identical email; do **not** accept a browser-provided user UUID or business ID.
4. Verify the mapped target user is active and that `business_members` authorizes the mapped business; fail closed on missing, disabled, revoked or inconsistent binding. Unit-test this logic with `resolveMyopsIdentityBinding`.
5. Implement a safe Supabase-compatible Auth session issuance design with server-side entitlement checks and RLS preserved, including revocation, CSRF protection, cookie lifecycle and tenant boundary tests, before opening `/api/myops/launch` (currently fail-closed HTTP 503).
6. Configure MYOPS Ed25519 public key / OpsFinance private key pairing only in approved deployment secret stores; never commit secrets.
7. Before any production schema/Auth changes, verify current backups or point-in-time recovery, inspect existing schema and RLS, prepare reversible migration and staging-equivalent isolated testing, require successful CI and approved deployment. Never perform destructive or unaudited mutations to existing users.
8. Explicitly test sign-in, session refresh, logout, revoked MYOPS entitlement, expired/replayed launch tickets, missing user binding, mismatched business membership, and a different tenant.

## Current code milestone
- Signed MYOPS application calls: implemented in `lib/auth/myops-sso-client.ts`
- Fragment-clearing `/launch`: implemented
- Unconfigured exchange endpoint: deliberately HTTP 503
- Identity authorization contract: implemented in `lib/auth/myops-identity-binding.ts`, not yet attached to a live database or session issuer
- Nothing in this milestone claims completed cross-app login.

**Production target selected:** `ozkjsihuovzpujuabupa`. **Next gate:** verified backup/recovery readiness, reviewed identity/session implementation and a safe controlled production migration; no DB writes yet.
