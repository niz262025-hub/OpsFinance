# OpsFinance Roadmap

Phase 0 is documentation only. Each later phase must preserve the locked
requirements in [PRODUCT_SPEC.md](PRODUCT_SPEC.md) and the accounting source
of truth in [ACCOUNTING_ENGINE.md](ACCOUNTING_ENGINE.md).

## Phases

0. **Phase 0: Foundation documentation** - lock product, accounting, data, security,
   workflow, and roadmap requirements.
1. **Phase 1: Project setup + database + authentication** - establish the application
   repositories/runtime, PostgreSQL foundation, migrations, identity, and
   membership checks.
2. **Phase 2: Accounting engine + Chart of Accounts + Financial Accounts** - complete
   in code for shared server-side accounting primitives, business-scoped starter
   chart provisioning, financial account lifecycle enforcement, and cross-business
   safety guards. Live Supabase UAT verification remains gated on configured project
   credentials and environment variables; Phase 3 has not started.
3. **Phase 3: Transactions + Journal + Ledger** - implement transaction lifecycle,
   balanced atomic posting, immutable corrections, and ledger queries.
4. **Phase 4: Financial Reports** - implement the six reports from posted journal lines.
5. **Phase 5: Upload & Convert** - implement secure extraction, normalization,
   suggestions, review, approval, and non-automatic posting flow.
6. **Phase 6: Bank Reconciliation** - implement matching, differences, locks, history,
   and audit without bypassing the accounting engine.
7. **Phase 7: Accounting Rules** - implement configurable, testable rule evaluation.
8. **Phase 8: Subscription + Starter entitlement** - implement plan lifecycle,
   server-side limits, payment separation, and retained data on suspension.
9. **Phase 9: Web UI** - implement the locked navigation and workflows in Next.js.
10. **Phase 10: Mobile iOS + Android** - implement React Native + Expo clients using the
    same API and accounting engine.
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