-- Create the user_group_positions table
create table if not exists public.user_group_positions (
    user_id      uuid references public.profiles(id) on delete cascade not null,
    group_letter text not null,
    "order"      text[] not null,
    primary key (user_id, group_letter)
);

alter table public.user_group_positions enable row level security;

-- RLS policies for user_group_positions
create policy "Users can read own group positions"
    on public.user_group_positions for select
    using (auth.uid() = user_id);

create policy "Users can insert own group positions"
    on public.user_group_positions for insert
    with check (auth.uid() = user_id);

create policy "Users can update own group positions"
    on public.user_group_positions for update
    using (auth.uid() = user_id);

create policy "Users can delete own group positions"
    on public.user_group_positions for delete
    using (auth.uid() = user_id);

-- pts_earned column + scoring rule
alter table public.user_group_positions
    add column if not exists pts_earned integer not null default 0;

insert into public.scoring_rules (rule_key, pts, description) values
    ('group_position_correct', 2, 'Correct predicted position in group (1st-4th)')
on conflict (rule_key) do nothing;

NOTIFY pgrst, 'reload schema';
