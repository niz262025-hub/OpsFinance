# OpsFinance SSO implementation checkpoints (cf3157d)

Audit date: 2026-10-24. Branch-only planning. No production deployment.

## Current verified behavior
- `app/login/page.tsx` uses direct Supabase `signInWithPassword`, independent of MYOPS launch tickets.
- `middleware.ts` checks Supabase `getUser()` on protected routes.
- `lib/auth/navigation.ts` currently enables preview bypass automatically when `VERCEL_ENV=preview`, even without an explicit opt-in.
- `app/auth/callback/route.ts` exchanges a Supabase auth code, not a MYOPS app launch ticket.
- There is no verified OpsFinance `/launch` ticket consumer in the audited baseline.

## Required safe implementation order
1. Disable automatic auth bypass for all remotely deployed UAT/preview environments. Permit demo bypass only with explicit, tightly restricted local development settings, never when real business data is accessible.
2. Add a transient `/launch` browser page that reads the ticket from URL fragment and immediately removes the fragment before network requests.
3. Implement a server-side ticket redemption adapter matching MYOPS signed app-client protocol; no secrets or private signing keys in browser code.
4. Establish a verifiable server-side OpsFinance session, including a mapped identity and authorized business. Do not assume a MYOPS ticket is interchangeable with a Supabase access token.
5. Verify that middleware and every API route reject missing or revoked sessions. Enforce business membership and RLS independently of frontend navigation.
6. On success, redirect to `/dashboard`; on any failure, deny access and offer MYOPS login, without exposing ticket or internal authorization details.
7. Test one-time redemption, expiry, signature/nonce rejection, entitlement revocation, session/logout, and cross-business access.

## Domains
- UAT: `uat-finance.myops.com.my`
- Production after explicit approval: `finance.myops.com.my`

## Blockers before activating launch
- UAT MYOPS app-client registration and signing-key configuration must be verified.
- The two applications' session architecture must be reconciled with Supabase RLS.
- No live UAT test results have yet been obtained.

This file does not grant approval to merge, enable a production feature, or deploy.
