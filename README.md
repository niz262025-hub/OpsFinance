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
