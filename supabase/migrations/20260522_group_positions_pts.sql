-- ============================================================
-- Phase 3: User Group Positions table — add pts_earned column
-- Also adds scoring rule for group position correctness.
-- Run this in Supabase SQL Editor.
-- ============================================================

alter table public.user_group_positions
    add column if not exists pts_earned integer not null default 0;

insert into public.scoring_rules (rule_key, pts, description) values
    ('group_position_correct', 2, 'Correct predicted position in group (1st-4th)')
on conflict (rule_key) do nothing;
