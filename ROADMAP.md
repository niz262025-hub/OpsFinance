# OpsFinance Roadmap

Phase 0 is documentation only. Each later phase must preserve the locked
requirements in [PRODUCT_SPEC.md](PRODUCT_SPEC.md) and the accounting source
of truth in [ACCOUNTING_ENGINE.md](ACCOUNTING_ENGINE.md).

## Phases

0. **Phase 0: Foundation documentation** - complete and locked. The product,
   accounting, data, security, workflow, and roadmap requirements are set.
1. **Phase 1: Project setup + database + authentication** - complete. The repository
   includes the application runtime, PostgreSQL/Supabase foundation, migrations,
   identity, and membership checks.
2. **Phase 2: Accounting engine + Chart of Accounts + Financial Accounts** - complete.
   This phase includes shared server-side accounting primitives, business-scoped
   starter chart provisioning, financial account lifecycle enforcement, and
   cross-business safety guards. Live Supabase UAT verification remains gated on
   configured project credentials and environment variables.
3. **Phase 3: Transactions + Journal + Ledger** - complete. This phase includes the
   transaction lifecycle, journal entry and journal line creation, balanced
   journal validation, atomic posting, posting idempotency, immutability guards,
   reversal/correction support, and ledger queries derived exclusively from
   posted journal lines. Closed-period checks, cross-business isolation, and
   audit trail enforcement are included.
4. **Phase 4: Financial Reports** - complete. This phase includes the six required
   reports: Trial Balance, Profit & Loss, Balance Sheet, Cash Flow, General
   Ledger, and Account Statement. Reporting is derived exclusively from POSTED
   journal lines, respects business isolation, handles reversal/correction
   semantics, and uses deterministic DecimalMoney aggregation for all balances.
5. **Phase 5: Upload & Convert** - complete. This phase includes secure file
   validation, extraction, normalization, accounting suggestions, duplicate and
   idempotency controls, business isolation, review-first workflow, and explicit
   approval before any posting action. Safety contract: `AUTO-SUGGEST = YES` and
   `AUTO-POST = NO`. Even at 100% extraction confidence, no financial transaction
   may be automatically approved or posted. Posting remains a separate explicit
   step that uses the existing authoritative Phase 3 accounting engine.
6. **Phase 6: Bank Reconciliation** - complete. This phase includes the validated
   reconciliation workflow for session-based matching, unmatched and partial
   differences, completion guards, and reconciliation lock/audit history without
   creating a second ledger or altering posted accounting balances. Bank and
   statement evidence are compared against the authoritative POSTED accounting
   ledger and report path.
7. **Phase 7: Accounting Rules** - complete. This phase includes configurable,
   testable rule evaluation, business-scoped persistence, deterministic priority
   ordering, same-business account validation, upload suggestion integration, and
   database-layer protections that keep `auto_post` disabled. The rule service
   remains suggestion-only and never bypasses the authoritative accounting engine.
8. **Phase 8: Subscription + Starter entitlement** - complete. This phase includes
   the validated Starter contract, server-side business/user limits, business-
   scoped entitlement enforcement, payment/accounting separation, and suspension
   safety that retains accounting history without deleting posted journal data.
9. **Phase 9: Web UI** - complete. This phase includes the validated Next.js Web UI,
   production-safe authentication, tenant-aware business workflows, transaction
   processing, upload/review workflows, bank reconciliation, six financial
   reports, Accounting Rules, subscription settings, and production preview
   protection that keeps preview/demo data out of production.
10. **Phase 10: Mobile iOS + Android** - next planned phase. Do not start until the
    validated web UI and server/accounting contract remain in place.
11. **Phase 11: Security hardening + QA** - complete threat review, isolation tests,
    upload tests, integrity tests, performance, accessibility, and recovery
    verification.
12. **Phase 12: Production deployment + Go-Live** - deploy, observe, restore-test,
    document operations, and release only after acceptance criteria pass.

## Required phase loop

Every phase follows exactly:

```text
BUILD -> TEST -> FIX -> RETEST -> PASS -> COMMIT -> PUSH
```

No phase may begin before the previous phase's validation and documentation
are complete. Phase 0 is complete and locked. Phase 1 foundation is complete and
validated. Future phases remain in the roadmap and have not started.