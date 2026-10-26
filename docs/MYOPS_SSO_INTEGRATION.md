# MYOPS single-login integration contract (OpsFinance)

Status: staged implementation with automated tests; disabled by default and NOT enabled in production.

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

## Staged implementation

The feature is disabled by default. `MYOPS_SSO_ENABLED=true` and
`NEXT_PUBLIC_MYOPS_SSO_ENABLED=true` must both be configured at build/deployment time.
The server refuses activation when `VERCEL_ENV=production`.

- `/launch` removes the entire query/fragment before any redemption POST. Only a single
  43-character ticket fragment field is accepted. React StrictMode cannot redeem twice.
- `/api/myops/launch` enforces the configured exact HTTPS origin and JSON POST, then
  signs the server-to-server MYOPS request with Ed25519. No caller identity is accepted.
- `myops_identity_links` maps an app-scoped opaque `user_ref` to an existing confirmed
  Supabase auth user and existing business membership. Rows default to disabled.
  Provisioning is service-role only; RLS and browser-role privilege revocation apply.
  A composite foreign key prevents linking a user to a business they do not belong to.
- The server generates and consumes a one-time Supabase proof for that exact mapped
  account. It verifies returned user ID, confirmed email and RLS-backed membership.
  No email-based auto-linking, account signup or service-role business-data reads occur.
- The Supabase user access token stays in an AES-GCM sealed `__Host-opsfinance-sso`
  cookie with Secure, HttpOnly and SameSite=Lax. Refresh tokens are discarded. The
  session cannot outlive the user access JWT; expiry requires a new MYOPS launch.
- Middleware checks the central session before protected pages and legacy APIs.
  Server-side clients additionally revalidate the mapping, local user and membership.
- Browser PostgREST requests go through the allowlisted `/api/myops/data/...` proxy,
  which revalidates central access and uses the mapped user's JWT, preserving RLS.
  Caller credentials and arbitrary upstream paths cannot choose another identity.
- App sign-out clears the app cookie and returns to the MYOPS dashboard, where the
  user can invoke central logout. It does not claim a GET redirect logs out MYOPS.
  An actual MYOPS logout is enforced on subsequent page/API/data requests.

## Required staging setup

1. Use isolated staging resources with a reviewed backup/recovery plan. Apply the
   MYOPS entitlement and session proposals only after their separate review.
2. Apply `20261026171551_myops_identity_links.sql` on OpsFinance staging. Enroll the
   OpsFinance Ed25519 public key on MYOPS; keep private key and app-session encryption
   key only in server environment variables. Set exact `MYOPS_ORIGIN` and
   `OPSFINANCE_ORIGIN` without paths or trailing slashes.
3. Configure Supabase server URL, public key and service-role key. Insert explicit
   identity mappings through an authorized administrative workflow; enable only after
   confirming ownership and membership. Do not accept mapping requests from browsers.
4. Enable both flags for that staging deployment and rebuild. Use an entitled MYOPS
   test account to launch, reload, mutate data, revoke entitlement and centrally log out.

Rollback: disable both flags and redeploy; retain the additive mapping table and RLS.
The migration creates no links and changes no existing user or business records.

## Production release gate

This branch is a staged integration, not production-ready SSO. Existing direct Supabase
credentials/tokens may still reach the Data API outside the new proxy. Before cutover,
implement and verify a Data API broker gate (or equivalent database-level enforcement)
so all business-data access must pass the central authorization check. Do not remove the
production refusal just by flipping flags. Finish MYOPS production SQL, credential
registration, full browser E2E, live cross-tenant tests and review before activation.

Storage uploads and Realtime are not proxied by this implementation; fail closed rather
than exposing user tokens. Extend these paths with dedicated authorization before use.

## Verification scope

Automated tests cover cookie confidentiality/tamper/expiry, CSRF, forged identities,
fragment clearing, one-time client submission, revoked authorization, mapping/user
mismatch, missing membership, proxy path/credential restrictions and SQL membership
provisioning. They do not replace a real end-to-end MYOPS launch in staging.
# Data API broker gate (installed disabled)

Migration `20261026175057_myops_data_api_broker_gate.sql` installs a private,
disabled configuration singleton, a PostgREST pre-request hook and restrictive
policies on existing public RLS tables and Storage objects when present. It
refuses to replace an unrelated pre-request hook. Existing tenant policies still
decide which rows the authenticated Supabase identity may access.

Provision `MYOPS_DATA_BROKER_KEY` only on the application server (32–256 base64url
characters). Store only its SHA-256 hex digest in
`private.myops_broker_config.key_hash`. Enable the singleton only after verifying
the server sends the header and the staged migration preserves membership RLS.
The browser never receives this key. Requests with absent or incorrect keys are
denied, including direct requests using legacy local Supabase tokens. The
application checks central entitlement before supplying the broker credential.

Activation must be tested against real PostgREST, not only the SQL emulator.
Direct Realtime/Storage clients do not supply the server key and are denied when
the gate is active; their server-mediated feature paths still require delivery
before production. New exposed tables must include this restrictive policy.
Production SSO remains disabled until full runtime verification is complete.

Rollback (operator SQL): `update private.myops_broker_config set enabled=false where id=true;`
This restores prior tenant-policy behavior without deleting data or identity
mappings. Never log the plaintext broker credential or insert it into a migration.

