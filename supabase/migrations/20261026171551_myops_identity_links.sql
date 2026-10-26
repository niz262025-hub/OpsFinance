-- Preprovisioned, app-scoped MYOPS identity mapping. Never link by browser email.
-- Rollback: disable the deployment feature flags; retain this empty/additive table.
-- No live provisioning is performed by this migration.
create table public.myops_identity_links (
  user_ref text primary key check (user_ref ~ '^[A-Za-z0-9_-]{43}$'),
  supabase_user_id uuid not null references auth.users(id) on delete restrict,
  business_id uuid not null,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (business_id, supabase_user_id)
    references public.business_members(business_id,user_id) on delete cascade
);
alter table public.myops_identity_links enable row level security;
revoke all on public.myops_identity_links from public, anon, authenticated;
grant select, insert, update, delete on public.myops_identity_links to service_role;
