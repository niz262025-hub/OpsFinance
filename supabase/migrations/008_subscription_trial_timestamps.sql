alter table public.subscriptions
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz;

create index if not exists idx_subscriptions_trial_ends_at
  on public.subscriptions (trial_ends_at);

comment on column public.subscriptions.trial_started_at is 'UTC timestamp when the 7-day free trial started for the subscription.';
comment on column public.subscriptions.trial_ends_at is 'UTC timestamp when the 7-day free trial expires for the subscription.';
