create or replace function public.is_authorized_for_business(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = p_business_id
      and bm.user_id = auth.uid()
  );
$$;

create or replace function public.is_business_owner_or_admin(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = p_business_id
      and bm.user_id = auth.uid()
      and bm.role in ('OWNER', 'ADMIN')
  );
$$;

create or replace function public.is_posted_journal_entry(p_journal_entry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.journal_entries je
    where je.id = p_journal_entry_id
      and je.status = 'POSTED'
  );
$$;

create or replace function public.is_posted_journal_line(p_journal_entry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.journal_entries je
    where je.id = p_journal_entry_id
      and je.status = 'POSTED'
  );
$$;

create or replace function public.prevent_posted_journal_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'POSTED' then
      raise exception 'Posted journal entries must be created through the posting workflow.';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status = 'POSTED' then
      raise exception 'Posted journal entries are immutable';
    end if;
    raise exception 'Journal entries cannot be deleted; use a reversal or adjustment.';
  end if;

  if old.status = 'POSTED' then
    raise exception 'Posted journal entries are immutable';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_posted_journal_line_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if exists (
      select 1
      from public.journal_entries je
      where je.id = new.journal_entry_id
        and je.status = 'POSTED'
    ) then
      raise exception 'Posted journal lines are immutable';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if exists (
      select 1
      from public.journal_entries je
      where je.id = old.journal_entry_id
        and je.status = 'POSTED'
    ) then
      raise exception 'Posted journal lines are immutable';
    end if;
    raise exception 'Journal lines cannot be deleted; use a reversal or adjustment.';
  end if;

  if exists (
    select 1
    from public.journal_entries je
    where je.id in (old.journal_entry_id, new.journal_entry_id)
      and je.status = 'POSTED'
  ) then
    raise exception 'Posted journal lines are immutable';
  end if;

  return new;
end;
$$;

create trigger journal_entries_prevent_posted_update
before insert or update or delete on public.journal_entries
for each row
execute function public.prevent_posted_journal_mutation();

create trigger journal_lines_prevent_posted_update
before insert or update or delete on public.journal_lines
for each row
execute function public.prevent_posted_journal_line_mutation();
