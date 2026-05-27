-- Fix: drop and recreate official_group_positions policies

drop policy if exists "Public read official positions" on public.official_group_positions;
create policy "Public read official positions"
    on public.official_group_positions for select
    using (true);

drop policy if exists "Master can manage official positions" on public.official_group_positions;
create policy "Master can manage official positions"
    on public.official_group_positions for all
    using ((select is_master from public.profiles where id = auth.uid()))
    with check ((select is_master from public.profiles where id = auth.uid()));

drop policy if exists "Public read official bracket" on public.official_bracket;
create policy "Public read official bracket"
    on public.official_bracket for select
    using (true);

drop policy if exists "Master can manage official bracket" on public.official_bracket;
create policy "Master can manage official bracket"
    on public.official_bracket for all
    using ((select is_master from public.profiles where id = auth.uid()))
    with check ((select is_master from public.profiles where id = auth.uid()));
