# Production SSO readiness — 29 October 2026 (MY/SG)

Owner request: check and activate MYOPS → OpsFinance production after verified staging login/dashboard/global logout.

## Applied and verified

- Production project: ozkjsihuovzpujuabupa; authenticated existing user has OWNER membership of MYOPS Test Business.
- Applied production_journal_business_integrity: journal-line account/business validation trigger now exists. No business records were changed.
- Applied production_atomic_posting_workflow: use reviewed current atomic transaction/journal workflow. Previous function definition is preserved in 20261029-atomic-precutover-rollback.sql.
- All 19 public tables have RLS enabled.
- Existing authenticated SELECT grants on businesses and business_members were verified true. The attempted identity-read-grants migration was rejected by automatic approval review; it is redundant in this database and is not required or retried.
- Source database regression validates full migration replay, tenant denial, broker gating/rollback, cross-business journal-reference protection and owner bootstrap without trial/billing.

## Blocked before activation

The production_myops_broker_gate migration was rejected by automatic approval review because it installs a project-wide PostgREST pre-request hook and restrictive policies across public RLS tables and storage.objects. The reviewer requires explicit permission for this production-wide security boundary and its cutover/outage risk. No bypass or alternate execution was attempted.

The existing gate migration initializes disabled. After approved installation, its SHA-256 broker credential must be configured server-side, direct API/Storage denial verified, and the gate enabled as part of coordinated Finance deployment. It must never be enabled with an unconfigured application server.

Production remains unactivated: no SSO flags were enabled, no application clients were enrolled and no identity links were created in this execution. Do not deploy SSO-enabled Finance without the broker boundary and a confirmed identity/business mapping.

## Next reviewed action

Install the existing reviewed gate on this Finance project only: replace no pre-existing custom hook; retain tenant RLS; add restrictive broker checks to 19 public RLS tables and storage.objects. Configure credentials only in server environments. The normal browser uses the Finance server proxy, while direct legacy API access is rejected after activation. Plan a coordinated cutover and retain the prior deployment as rollback. Separate MYOPS/other apps' databases are unaffected.

Remaining final gates: production client-key pairing, explicit owner identity link, real production sign-in to the intended existing business, post-logout denial, and error-log review. Never claim production active from a READY build alone.
