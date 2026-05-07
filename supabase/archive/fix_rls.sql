-- ✅ Safe to run even if schema.sql was already applied.
-- Only adds the 2 missing policies. Will NOT duplicate anything.

-- 1. Allow the sign-up trigger to insert a profile row
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'profiles'
      and policyname = 'Users can insert own profile'
  ) then
    execute $p$
      create policy "Users can insert own profile"
      on public.profiles for insert
      with check (auth.uid() = id)
    $p$;
  end if;
end $$;

-- 2. Allow everyone (including logged-out users) to read the lock date
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'config'
      and policyname = 'Anon read config'
  ) then
    execute $p$
      create policy "Anon read config"
      on public.config for select
      using (true)
    $p$;
  end if;
end $$;
