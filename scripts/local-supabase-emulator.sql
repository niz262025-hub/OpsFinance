create schema if not exists auth;

-- Minimal Supabase Auth relation needed by the service-managed MYOPS identity-link FK.
-- The emulator validates migration structure only; it does not model Supabase Auth.
create table if not exists auth.users (
  id uuid primary key
);

create role anon nologin;
create role authenticated nologin;

grant usage on schema auth to anon, authenticated;

drop function if exists auth.uid();
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.session_user_id', true), '')::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(current_setting('app.role', true), 'authenticated');
$$;

grant execute on function auth.role() to anon, authenticated;

create or replace function auth._set_session_user(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('app.session_user_id', coalesce(p_user_id::text, ''), true);
end;
$$;

grant execute on function auth._set_session_user(uuid) to authenticated;
