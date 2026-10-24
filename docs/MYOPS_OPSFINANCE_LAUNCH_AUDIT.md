# OpsFinance environment and MYOPS launch readiness

Baseline: `cf3157d`. This is an audit plan, not a production activation.

| Environment | Intended hostname | Purpose |
| --- | --- | --- |
| MYOPS production | `myops.com.my` | Central login, subscription and app selection |
| OpsFinance UAT | `uat-finance.myops.com.my` | Validate integration and accounting |
| OpsFinance production | `finance.myops.com.my` | Customer application after UAT approval |

## Launch contract

1. MYOPS authenticates the user and verifies entitlement to OpsFinance.
2. MYOPS initiates a short-lived, single-use, browser-bound launch handoff.
3. OpsFinance verifies the handoff server-side, establishes an authenticated application session and resolves the user's authorized business.
4. Only after verification does OpsFinance redirect to `/dashboard`.
5. Invalid, expired or replayed handoffs must fail closed; never enable a dashboard authentication bypass in production.
6. The destination hostname must be configured per environment, not hardcoded to the UAT hostname in production.

## Audit gates before enabling the MYOPS button

- Implement and verify the launch exchange at both ends; a plain dashboard hyperlink does not provide SSO.
- Verify Supabase auth/session strategy and business membership/RLS with two distinct test businesses.
- Confirm an unentitled user cannot launch the application.
- Correct dashboard reporting: recent journal limit must not constrain financial aggregates; journal totals should not use balanced debit-minus-credit as transaction value.
- Run typecheck, lint, tests, build and browser UAT.
- Confirm DNS, HTTPS, environment secrets and production deployment only after explicit approval.

Do not merge or deploy this audit branch automatically.
