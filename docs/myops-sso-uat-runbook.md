# MYOPS → OpsFinance UAT runbook

## Preconditions (do not use production secrets)
1. Deploy this branch to the OpsFinance UAT environment only.
2. Confirm the MYOPS UAT app service supports signed single-use ticket redemption and points its OpsFinance launch URL to the UAT deployment.
3. Set server-only `MYOPS_APP_API_ORIGIN`, `MYOPS_APP_ID`, `MYOPS_APP_PRIVATE_KEY` and Supabase URL/anon/service-role keys in the UAT environment. Never put private keys in `NEXT_PUBLIC_*` variables.
4. Resolve historical Supabase migration ledger gaps before applying migration 014, then link a verified MYOPS `user_ref` to an existing OpsFinance auth user with valid business membership. Do not create links from untrusted browser requests.
5. Keep `MYOPS_SSO_ENABLED` unset until the preceding prerequisites are confirmed. Enable it only in UAT for the test window.

## Browser acceptance
1. Login to MYOPS UAT as an entitled test user and open OpsFinance.
2. Confirm the fragment disappears from the address bar and the browser lands at `/dashboard` with a genuine Supabase Auth session; reload and check persistence.
3. Logout and confirm the dashboard is inaccessible without authentication.
4. Repeat with an expired/replayed/wrong-product ticket, an unlinked identity and a user with no business membership. Each must fail without a dashboard session.
5. Confirm business A cannot read business B records using the user's own authenticated session.
6. Inspect browser network, cookies and server logs for ticket, private key or token leaks. Do not include actual secrets in test evidence.

## Release decision
Record evidence and obtain explicit owner approval before any production merge, deploy or enabling SSO in production. If any check fails, disable `MYOPS_SSO_ENABLED` and investigate.
