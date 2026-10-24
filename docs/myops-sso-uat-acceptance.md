# MYOPS to OpsFinance SSO acceptance criteria

## Current state
- The launch page removes the one-time ticket from the URL fragment.
- The redemption endpoint is wired to a linked Supabase session bridge behind `MYOPS_SSO_ENABLED=true`; it returns 503 while the flag is disabled.
- Automated CI passed on commit `2aa4ca6`, but live UAT SSO has not been exercised and must not be described as complete.
- The identity mapping table is service-role only and must not grant business membership by itself.

## Required end-to-end flow
1. MYOPS authenticates the user and verifies their OpsFinance entitlement.
2. MYOPS issues a short-lived, single-use launch ticket scoped to OpsFinance.
3. OpsFinance validates the request origin and redeems the ticket with the signed server-to-server app credential.
4. OpsFinance resolves the opaque MYOPS user reference to a previously approved Supabase Auth user.
5. OpsFinance checks the user's business membership and creates a legitimate Supabase Auth session using a supported, reviewed authentication flow. Never fabricate a JWT, accept a browser-supplied user ID, or bypass RLS.
6. The session cookie is issued securely and the browser enters the dashboard only after authentication succeeds.

## Security review before enabling UAT
- Review the administrative magic-link exchange and confirm it cannot create or sign in a different user when a verified email is reused.
- Confirm Supabase SSR session cookies are set only after the returned user ID matches the approved mapping, and that a failed exchange never returns authentication cookies.
- Test repeat and concurrent redemption attempts; a consumed one-time ticket must never establish a second session.
- Verify `MYOPS_SSO_ENABLED` remains unset in production until explicit release approval.

## Blocking prerequisites
- Confirm and test the official Supabase session issuance method for a separate Supabase project.
- Configure UAT MYOPS app signing keys, allowlisted domains and OpsFinance Supabase credentials in server-only environment variables.
- Reconcile missing historical migration versions before applying the identity-link migration.
- Run a real browser integration test for MYOPS login, launch, session persistence and logout.

## Mandatory negative tests
- Expired, reused, malformed or wrong-product tickets fail.
- Missing mapping or missing business membership fails without a session.
- A Business A user cannot query Business B data via RLS.
- Vercel Preview and Production never allow preview auth bypass.
- No ticket or signing key appears in logs, URLs after fragment removal, or client-side bundles.

## Release gate
No production merge, production deployment or SSO enablement until the above tests pass in UAT and the owner approves deployment.
