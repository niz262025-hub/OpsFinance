-- MYOPS identity binding for OpsFinance (separate Supabase project).
-- Apply only after the missing historical migration ledger entries have been reconciled.
-- Binding must be created by a trusted server after verifying the MYOPS ticket,
-- never by a browser-supplied user ID or user_ref.

create table if not exists public.myops_identity_links (
  myops_user_ref text primary key,
  opsfinance_user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint myops_identity_ref_format check (myops_user_ref ~ '^[A-Za-z0-9_-]{43}$')
);

alter table public.myops_identity_links enable row level security;
revoke all on public.myops_identity_links from public, anon, authenticated;
-- Deliberately no policies: only trusted server-side service role can manage links.
-- No automatic user provisioning or business membership is granted by this table.

comment on table public.myops_identity_links is
  'Trusted server-managed mapping of opaque MYOPS identity references to OpsFinance auth.users; no client access.';
