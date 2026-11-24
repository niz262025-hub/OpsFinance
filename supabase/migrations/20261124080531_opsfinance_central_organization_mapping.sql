-- Additive mapping only. No existing business is assigned automatically.
begin;
create unique index if not exists myops_identity_links_ref_user_uidx on public.myops_identity_links(user_ref,supabase_user_id);
create table public.myops_organization_business_links (
  organization_id uuid not null,
  user_ref text not null,
  supabase_user_id uuid not null,
  business_id uuid not null,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (organization_id,user_ref),
  foreign key (user_ref,supabase_user_id) references public.myops_identity_links(user_ref,supabase_user_id) on delete cascade,
  foreign key (business_id,supabase_user_id) references public.business_members(business_id,user_id) on delete cascade
);
alter table public.myops_organization_business_links enable row level security;
revoke all on public.myops_organization_business_links from public,anon,authenticated;
grant select,insert,update,delete on public.myops_organization_business_links to service_role;
commit;
