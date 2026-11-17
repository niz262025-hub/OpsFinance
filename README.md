# OpsFinance

**Accounting Made Simple**

OpsFinance is a serious cloud accounting platform for small and medium-sized
businesses. It is designed as a modern SaaS product for web, iOS, and Android,
with a shared server-side accounting engine as the single source of truth.

The product ecosystem is **OpsPS**, **OpsHub**, **OpsOne**, and **OpsFinance**.
The primary domain is `myops.com.my`; the application domain is
`app.myops.com.my`.

## Phase 0 status

Phase 0 baseline is complete and locked. It contains the authoritative product,
accounting, data, security, roadmap, and contribution foundation for the
project.

## Phase 1 status

Phase 1 foundation is complete. This repository now includes a minimal Next.js
application, TypeScript configuration, PostgreSQL/Supabase migration schema,
seeded default Chart of Accounts structure, business membership/auth foundation,
minimal authentication UI, and automated tests for the required scaffolding.

## Phase 2 status

Phase 2 is complete in the application codebase for the shared accounting
foundation implemented in this repository: accounting primitives, chart-of-
accounts validation and hierarchy handling, deterministic default starter COA
provisioning, business-scoped financial account service logic, non-destructive
archive/deactivate behavior, and safety checks for cross-business isolation.

The live MYOPS/Supabase end-to-end persistence test remains environment-gated
and requires a configured Supabase project, service-role credentials, and the
app's live environment variables. Local code validation is passing in this
workspace, while the live UAT integration remains a deployment prerequisite, not
an app-code failure.

## Phase 3 status

Phase 3 is complete in the application codebase for the server-side transaction
and journal flow. This repository now includes the transaction lifecycle,
journal entry creation, journal line creation, balanced journal validation,
atomic posting, posting idempotency, posted journal immutability, posted
journal-line immutability, reversal/correction support, and ledger queries that
derive exclusively from posted journal lines.

The implementation also includes debit-normal and credit-normal running balances,
closed accounting period protection, cross-business transaction/journal/ledger
isolation, posting and reversal audit traces, and database-level safeguards in
Supabase for business-scoped immutability and integrity enforcement.

## Phase 4 status

Phase 4 is complete. The repository contains the six required financial reports
and they are validated in the current codebase:

- Trial Balance
- Profit & Loss
- Balance Sheet
- Cash Flow
- General Ledger
- Account Statement

Only POSTED journal lines affect financial reports. The report layer uses the
authoritative accounting/ledger path and no second financial calculation source
has been introduced. Business isolation, reversal handling, and deterministic
monetary calculations remain enforced through the shared accounting engine.

Validation passed for the focused report suite: 27/27 tests passed. Typecheck,
lint, and production build also passed in this environment.

The live MYOPS/Supabase end-to-end persistence test remains environment-gated and
requires configured project credentials; it was not validated here because the
required live environment was unavailable.

## Phase 5 status

Phase 5 is complete. The repository includes the secure upload and conversion
workflow required for filing and review-first document processing:

- Upload & Convert
- file validation
- extraction
- normalization
- accounting suggestions
- human review
- explicit approval
- duplicate and idempotency controls
- business isolation
- malformed extraction safety
- existing accounting-engine handoff

The operating contract is explicit: `AUTO-SUGGEST = YES` and `AUTO-POST = NO`.
Even 100% extraction confidence cannot automatically approve or post a financial
transaction. Uploaded and extracted data must pass the required human review and
explicit approval workflow before any subsequent posting action. Any subsequent
posting uses the existing authoritative Phase 3 accounting engine, not a second
financial posting path.

The Phase 5 focused suite passed in this workspace, and the live Supabase
integration remains environment-blocked when the required MYOPS application access
is unavailable.

## Phase 6 status

Phase 6 is complete in the validated implementation. The repository contains the
bank reconciliation workflow implemented and checked for the actual accounting
boundary:

- bank / statement matching against posted accounting data
- session-based reconciliation workflow
- bank transaction and book transaction matching
- unmatched and partial difference analysis
- reconciliation completion guards
- lock and audit history enforcement
- business-scoped isolation

The authoritative accounting rule is explicit: Bank reconciliation compares bank
and statement evidence against the authoritative POSTED accounting ledger. It
must never create a second ledger, replace book balances with bank balances, or
silently create balancing transactions, journals, or journal lines. Posted
accounting history remains immutable and authoritative.

The reconciled workflow continues to preserve the source-of-truth path:

Transaction
→ Journal Entry + Journal Lines
→ POSTED
→ Ledger
→ Reports

The Phase 6 focused validation passed: 13/13 reconciliation tests passed.

## Phase 7 status

Phase 7 is complete in the validated application codebase. This repository
includes configurable accounting rules with deterministic evaluation, business-
scoped persistence, priority ordering, and deterministic tie-breaking for equal
priority rules. The service supports same-business account and financial account
references, inactive-account protection, and a Supabase persistence adapter that
maps the persisted `accounting_rules` contract back to the authoritative
`AccountingRuleService` model.

The Phase 7 implementation also includes business-scoped RLS protections,
server-side validation for cross-business account references, and upload/
convert integration that treats rules as suggestion-only guidance rather than as
an accounting posting path. The service respects the authoritative accounting
source of truth and preserves all posted accounting history.

Operating contract:

- `AUTO-SUGGEST = YES`
- `AUTO-APPROVE = NO`
- `AUTO-POST = NO`

Accounting Rules provide suggestions only. They cannot automatically approve or
post financial transactions, bypass the authoritative accounting engine, or
modify existing posted accounting history.

## Phase 8 status

Phase 8 is complete. This repository includes the validated subscription and
Starter entitlement contract, with server-side enforcement for the required
business and user limits.

Starter contract:

- Price: RM29/month
- Businesses: 1
- Users: 1

The validated implementation preserves a strict separation between subscription
state and customer accounting state. Subscription and entitlement checks are
business-scoped and enforced server-side, while accounting activity remains
owned by the authoritative posted journal/ledger/report path. Subscription
suspension does not delete accounting history or rewrite posted journal data.

Operating contract:

- `AUTO-SUGGEST = YES`
- `AUTO-APPROVE = NO`
- `AUTO-POST = NO`

The subscription layer is not a second accounting engine. It remains a billing
and entitlement function that cannot automatically create customer transactions,
journals, journal lines, or ledger entries.

## Phase 9 status

Phase 9 is complete. This repository contains the validated Next.js Web UI for
production-safe authentication, tenant-aware business context, workflow routing,
and the authoritative accounting/reporting experience across the product.

The Web UI is a presentation and workflow layer over the authoritative
OpsFinance server and accounting services. The Web UI does not introduce a
second financial calculation or posting path. Production authentication and
tenant isolation cannot fall back to preview/demo data.

Development preview remains allowed only when:

- the environment is development
- explicit preview opt-in is enabled

Production preview bypass remains disabled even when the preview flag is set.

Included and validated UI coverage:

- production-safe authentication
- business / tenant context resolution
- Dashboard
- Chart of Accounts
- Financial Accounts
- Transactions
- Upload & Convert
- Bank Reconciliation
- six Financial Reports
- Accounting Rules
- Subscription / Starter settings
- loading, empty, error, and unauthorized states
- responsive layout behavior
- accessibility baseline

The user-facing workflow contract remains:

- `AUTO-SUGGEST = YES`
- `AUTO-APPROVE = NO`
- `AUTO-POST = NO`

The authoritative server/accounting path remains the source of truth for all
posted accounting activity and financial reports.

Focused validation completed in this workspace:

- 11 focused UI/workflow test files passed
- 44/44 focused tests passed
- Typecheck PASS
- Lint PASS
- Production build PASS

Known live integration caveat:

- `tests/supabase-accounting-persistence.test.ts`
- `ENVIRONMENT BLOCKED: MYOPS application access required.`

Read the documents in this order:

1. [PRODUCT_SPEC.md](PRODUCT_SPEC.md) - locked product requirements
2. [ACCOUNTING_ENGINE.md](ACCOUNTING_ENGINE.md) - accounting source of truth
3. [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - planned PostgreSQL model
4. [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) - mandatory safeguards
5. [ROADMAP.md](ROADMAP.md) - phased delivery plan
6. [CONTRIBUTING.md](CONTRIBUTING.md) - development and Git discipline

## Target architecture

```text
Web (Next.js)                 Mobile (React Native + Expo)
		\               /
		 API / Service Layer
			   |
		   Accounting Engine
			   |
		      PostgreSQL
```

All financial outputs must derive from posted journal lines. Reconciliation,
reports, dashboards, web, and mobile must never introduce a second financial
calculation path.
