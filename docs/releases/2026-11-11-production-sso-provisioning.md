# Production identity provisioning repair — 11 November 2026

Release decision: HOLD pending authenticated staging UAT, verified backup/recovery, schema review and coordinated MYOPS release. This patch has not been deployed to production and no production migration was applied.

## Problem and resulting behavior

An empty `myops_identity_links` table leaves legitimate MYOPS launches without an authorized Finance identity. The existing bridge only invokes provisioning in Preview. Production also has an `auth.users` trigger, `sync_public_user_profile`, calling `handle_new_auth_user()`, which inserts `public.users`. The old provisioning RPC rejects any existing public profile, so simply enabling provisioning would still fail.

The bridge now permits provisioning in production only with `OPSFINANCE_MYOPS_PROVISIONING_READY=true`. Before provisioning, `ssoConfig()` still enforces the production broker gate and credentials, and signed ticket redemption and fresh central entitlement must succeed. The new migration accepts the exact app-owned public profile created by the auth trigger. It rejects a different email, any existing business membership or another identity mapping. Server-controlled app metadata and the synthetic identity must match. It never searches for a customer by email. The Auth API receives a descriptive name for the profile-sync trigger; that metadata grants no access.

The RPC remains SECURITY INVOKER and service-role-only. Advisory locking preserves retry behavior; disabled mappings remain disabled. Session creation still checks a confirmed local identity and the exact tenant membership. RLS and the Data API broker remain enforced.

## Database state verified read-only

- Production project: `ozkjsihuovzpujuabupa`; all public tables inspected have RLS enabled.
- Identity mappings: zero.
- Provisioning RPC: absent.
- Broker config: enabled. Browser role cannot SELECT identity links.
- Production migration history has 18 entries and does not include the provisioning RPC. Its version naming differs from repository migrations: do not blindly push every local migration.
- Security advisor warns about two mutable function search paths and exposed SECURITY DEFINER functions, including intended business authorization functions and trigger helpers. These need classification/review; no blanket permission changes were made.
- Staging configured by Vercel: `tfwizcztyktdurmiynzs`; neither connected account can access it. Central staging `wengxxiqwtosirealghx` is also inaccessible.

## Staging and production application sequence

1. Restore scoped access to the two actual staging projects and inspect their schema and auth triggers. Verify a usable backup/recovery point before production DDL.
2. Review and apply only `20261111103346_finance_myops_provisioning_auth_trigger_compatibility.sql` plus any individually verified missing prerequisites. This migration includes the RPC and its service-role grants; it does not require applying the older provisioning migration first.
3. Verify `has_function_privilege` denies `anon` and `authenticated` and permits `service_role`. Confirm no RLS/broker change.
4. Deploy the coordinated MYOPS and Finance candidates to their staging environments with their existing scoped credentials. Set central `MYOPS_FINANCE_PROVISIONING_READY=true` and Finance `OPSFINANCE_MYOPS_PROVISIONING_READY=true` only after verifying migration readiness. Do not copy production credentials into staging.
5. Complete real browser MYOPS login → launch → redemption → provision → membership → dashboard; test retries, paid/unpaid/admin, cross-tenant denial, logout and expiry. Verify exact origins, Ed25519 key pairing and accepted Vercel protection authentication. No protection change is included in this patch.
6. Only after all gates pass, retain prior deployment `dpl_68GwQ4J4KXUL63iAKbDgMsT3mwj5`, run the reviewed production migration, verify it, enable the readiness flags and deploy the coordinated release. Run authenticated production smoke tests and monitor errors.

## Verification evidence

Test logs are saved with this candidate. Tests replay repository migrations in a local PostgreSQL emulator and verify cross-tenant reads/writes, broker enforcement, authenticated/anonymous RPC access and trigger compatibility. These are not a live Supabase or authenticated browser UAT substitute.

Browser automation in this workspace could not start: the Playwright browser download was truncated, and installed system Chromium was denied `socket()` by the runtime. Public API tests ran, but browser cases are not PASS. No real-device Android/iOS readiness is claimed. External CI browser checks must pass before release.

## Rollback

Before applying the new migration, save the existing RPC definition and grants if it exists in the target; production inspection found it absent. For operational rollback turn off both provisioning readiness flags and roll back the paired app deployments. Preserve created identities, memberships and businesses. If this RPC was newly installed, `REVOKE EXECUTE ON FUNCTION public.opsfinance_provision_myops_identity(text,uuid,text,text,text) FROM service_role` stops new calls without deleting data; restore the captured previous definition/grants if one existed. Never bulk reset production or blindly replay/drop migrations.
