-- Fix all RLS policies that reference `auth.jwt() ->> 'org_id'`.
-- Supabase stores user metadata under `app_metadata`, so the correct path is
-- `auth.jwt() -> 'app_metadata' ->> 'org_id'`. We add a helper function and
-- rewrite every affected policy to use it.

-- 1. Helper function — works whether the claim is top-level or under app_metadata
create or replace function public.current_org_id()
returns uuid
language sql
stable
as $$
  select nullif(coalesce(
    auth.jwt() ->> 'org_id',
    auth.jwt() -> 'app_metadata' ->> 'org_id'
  ), '')::uuid;
$$;

-- 2. Rewrite all org_isolation_* policies to use current_org_id()
do $$
declare
  r record;
  q text;
begin
  for r in
    select tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual like '%org_id%' or with_check like '%org_id%')
  loop
    -- replace the broken claim path inside qual / with_check
    if r.qual is not null then
      q := replace(r.qual,
        '((auth.jwt() ->> ''org_id''::text))::uuid',
        'public.current_org_id()');
    else
      q := null;
    end if;

    declare
      wc text;
    begin
      if r.with_check is not null then
        wc := replace(r.with_check,
          '((auth.jwt() ->> ''org_id''::text))::uuid',
          'public.current_org_id()');
      else
        wc := null;
      end if;

      execute format('drop policy %I on public.%I', r.policyname, r.tablename);

      if r.cmd = 'SELECT' then
        execute format('create policy %I on public.%I for select using (%s)',
          r.policyname, r.tablename, q);
      elsif r.cmd = 'INSERT' then
        execute format('create policy %I on public.%I for insert with check (%s)',
          r.policyname, r.tablename, coalesce(wc, q));
      elsif r.cmd = 'UPDATE' then
        execute format('create policy %I on public.%I for update using (%s) with check (%s)',
          r.policyname, r.tablename, q, coalesce(wc, q));
      elsif r.cmd = 'DELETE' then
        execute format('create policy %I on public.%I for delete using (%s)',
          r.policyname, r.tablename, q);
      end if;
    end;
  end loop;
end$$;
