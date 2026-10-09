create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  provider text not null default 'CURLEC' check (provider in ('CURLEC')),
  provider_payment_id text,
  provider_reference text,
  checkout_session_id text,
  webhook_event_id text,
  amount numeric(10,2) not null default 29.00,
  currency text not null default 'MYR',
  status text not null default 'INITIATED' check (status in ('INITIATED', 'PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED')),
  payment_method text,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_payment_id),
  unique (checkout_session_id),
  unique (webhook_event_id)
);

create index if not exists idx_subscription_payments_business_id
  on public.subscription_payments (business_id);

create index if not exists idx_subscription_payments_subscription_id
  on public.subscription_payments (subscription_id);

create index if not exists idx_subscription_payments_provider_payment_id
  on public.subscription_payments (provider_payment_id);

create index if not exists idx_subscription_payments_status
  on public.subscription_payments (status);

alter table public.subscription_payments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'subscription_payments' and policyname = 'Members can view payments for their business'
  ) then
    create policy "Members can view payments for their business"
      on public.subscription_payments
      for select
      using (
        exists (
          select 1
          from public.business_members bm
          where bm.business_id = subscription_payments.business_id
            and bm.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'subscription_payments' and policyname = 'Members can insert payment rows for their business'
  ) then
    create policy "Members can insert payment rows for their business"
      on public.subscription_payments
      for insert
      with check (
        exists (
          select 1
          from public.business_members bm
          where bm.business_id = subscription_payments.business_id
            and bm.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'subscription_payments' and policyname = 'Members can update payment rows for their business'
  ) then
    create policy "Members can update payment rows for their business"
      on public.subscription_payments
      for update
      using (
        exists (
          select 1
          from public.business_members bm
          where bm.business_id = subscription_payments.business_id
            and bm.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.business_members bm
          where bm.business_id = subscription_payments.business_id
            and bm.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'subscription_payments' and policyname = 'Members can delete payment rows for their business'
  ) then
    create policy "Members can delete payment rows for their business"
      on public.subscription_payments
      for delete
      using (
        exists (
          select 1
          from public.business_members bm
          where bm.business_id = subscription_payments.business_id
            and bm.user_id = auth.uid()
        )
      );
  end if;
end $$;

create or replace function public.set_subscription_payment_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_subscription_payments_updated_at on public.subscription_payments;
create trigger trg_subscription_payments_updated_at
before update on public.subscription_payments
for each row
execute function public.set_subscription_payment_updated_at();
