# MYOPS single-login integration contract (OpsFinance)

Status: design and security gate only; NOT enabled in production.

## Required user journey
1. User authenticates only at MYOPS.
2. MYOPS checks OpsFinance entitlement server-side and issues a short-lived, single-use launch ticket scoped to OpsFinance.
3. Browser arrives at OpsFinance /launch with ticket in the URL fragment; the fragment is cleared immediately.
4. OpsFinance server exchanges the ticket with MYOPS /api/app/redeem using server-only app credentials.
5. OpsFinance establishes an HttpOnly, Secure, SameSite=Lax app session with short expiry and maps the verified MYOPS identity to an authorized local Supabase user/business context.
6. All dashboard pages, APIs and data operations validate both the local session and MYOPS entitlement via server-side checks. Tenant isolation and RLS remain enforced.
7. MYOPS logout, revocation and expiry invalidate OpsFinance access; unauthenticated visitors return to MYOPS /login with a validated return target.

## Hard security requirements
- Never pass Supabase service-role credentials or MYOPS app secrets to the browser.
- Do not accept a raw MYOPS user ID, query-string email, or client-controlled entitlement as authentication.
- Do not bypass middleware or Supabase RLS to make the dashboard load.
- Do not use the local preview auth bypass in production.
- Bind launch tickets to OpsFinance, expire quickly, redeem once, and reject replay.
- Avoid an automatic fallback to an OpsFinance login form after failed SSO.
- Keep independent OpsFinance subscription and payment flows disabled once MYOPS owns billing.
- Use environment-specific origins and an allowlist for return destinations.
- Test login, direct dashboard, refresh, unauthorized app, revoked entitlement, logout, expired session, replay, CSRF, and cross-tenant isolation.

## Current implementation blockers confirmed by source audit
- middleware.ts currently redirects protected routes to local /login.
- app/login/page.tsx still performs local Supabase password login.
- app/dashboard/page.tsx requires a Supabase-authenticated user and resolves their business context.
- No app/launch/page.tsx was found in main.
- A valid MYOPS app ticket alone does NOT produce a Supabase session. Identity mapping, tenant membership, and RLS need explicit implementation before enabling SSO.

## Acceptance checklist
- [x] Canonical repository confirmed: niz262025-hub/OpsFinance.
- [x] Existing local-login dependencies audited.
- [ ] Implement secure MYOPS ticket exchange and session binding.
- [ ] Map MYOPS account to Supabase user and authorized business without privilege escalation.
- [ ] Replace local login redirects with MYOPS login redirect.
- [ ] Verify entitlement on all protected endpoints.
- [ ] Add automated unit/integration/E2E and tenant-isolation tests.
- [ ] CI green and Production smoke test complete.
