# Finance access-check performance — 7 November 2026

Scope: first-priority Finance speed repair. Production is unchanged. Real dashboard/route targets remain BLOCKED pending a verifiable signed-in browser session and end-to-end measurements.

## Confirmed code finding and change

Before this repair, verifiedMyopsClient awaited central entitlement and identity mapping as one parallel group, then started local identity and membership validation as a second group. The second group depended only on the already authenticated encrypted application cookie and server configuration, so these read-only access checks can be started together.

The optimized path starts all four checks concurrently, compares the verified user/business mapping, local user and membership, and returns the RLS data client only after every check succeeds. It never caches user authorization, reuses a positive entitlement across requests, changes subscription/trial policy, extends inactivity or removes revocation checks. Only authorization metadata is queried during these checks; business/accounting queries still run after verified client issuance. The existing trial-client hook remains on the release branch.

Preview-only phase diagnostics record a fixed phase name and duration, without cookies, tokens, identifiers or payloads. Staging additionally retains middleware/business-context timing added for the baseline investigation. No production settings, database index/schema, migration or customer data changed.

## Controlled before/after evidence

Run node scripts/benchmark-myops-access.cjs. The checked-in baseline is the exact staging myops-server source from commit a66fee14d09d1e5f98f27f4da570cbf5787eb6ec. Both versions execute against the same four simulated remote latencies: central 120ms, mapping 180ms, local identity 140ms, local membership 100ms. There is no real network or customer data in this fixture.

| Measure | Before | After |
| --- | ---: | ---: |
| Median access-check fixture time, 2 warmups + 5 samples | 321.381ms | 179.973ms |
| Independent read checks performed per run | 4 | 4 |
| Verification scheduling groups | 2 | 1 |
| Result snapshot SHA-256 | 29214366138b95b89f97a57b541a883dea48e7f017bfc5ec7fb69dbc46d65d4a | Same within this run |
| Actual dashboard usable time | Not established | Not established |
| Actual ordinary route transition | Previously observed slow; no controlled baseline | Not established |

This is approximately 44% faster in the controlled latency fixture. It is not a 44% website-speed claim or evidence that the 2-second/1-second targets pass. The result snapshot covers the simulated auth client/session identity and check counts, not financial report accuracy. The benchmark substitutes the trial hook; separate trial-policy/client tests cover its behavior.

## Verification and unresolved gate

- Staging full suite: 308 PASS, 1 environment-dependent database SKIP. A follow-up 10-test identity suite passed after aligning the mocked paid-access result with the release contract.
- Focused access/proxy/middleware/transport/business-isolation/dashboard/form regression: 42 PASS.
- Both staging and release worktree TypeScript checks passed.
- New tests demonstrate that all four read-only checks start while central approval is still pending, no usable client is exposed until approval, and each central/mapping/local-identity/membership revocation still denies access. A fake-timer test completes four 120/180/140/100ms checks in one 180ms scheduling group.
- The first release-suite attempt reported 3 failures and an unhandled error because the old identity-test mock returned undefined where the existing release trial hook requires a paid/trial access object. The mock was corrected to return paid access; no runtime policy was relaxed. Full release rerun passed: 322 PASS, 1 SKIP, zero failures or unhandled errors (68 passing files, 1 skipped).
- Browser Performance APIs were unavailable through the supported browser surface. Vercel runtime log lookup returned no phase records before a successful authenticated request; a read-only Observability query returned 400, so no production/platform latency numbers are inferred.
- The secure browser sign-in request timed out and the browser runtime reset. The owner reported logging in, but a fresh cloud-browser /account still returned /login. This is not a claim that the owner's own login failed. Real authenticated before/after timing remains BLOCKED; no auth bypass was introduced.

## UAT and rollback

Once a cloud-browser authenticated session is verifiable, compare the exact baseline and optimized preview builds on the same Finance staging alias. Use the same Chrome desktop/network, synthetic fixture and cache condition, record cold versus warm separately, and take at least five samples for dashboard usable content and Money In/Money Out navigation. Confirm RM85 cash, RM125 revenue, RM40 expenses and RM85 profit, plus denied direct entry/revoked session, trial limits and 15-minute inactivity. Do not promote before this evidence and owner release approval.

Rollback the preview alias to baseline deployment dpl_7EMKTUrFx27TEcLshd5xCNh5LKVx if the optimized access flow fails. No data rollback or migration is required. Release candidate changes remain in draft PR 37.
