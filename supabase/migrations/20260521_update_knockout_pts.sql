-- ============================================================
-- Migration: Update knockout scoring rules + add R32
-- Run this in your Supabase SQL Editor
-- Date: 2026-05-21
-- ============================================================

-- Add new R32 scoring rule
INSERT INTO public.scoring_rules (rule_key, pts, description)
VALUES ('ko_reach_r32', 2, 'Team correctly predicted in R32')
ON CONFLICT (rule_key) DO UPDATE SET pts = 2, description = excluded.description;

-- Update existing knockout progression rules
UPDATE public.scoring_rules SET pts = 5,  description = 'Team correctly predicted in R16'   WHERE rule_key = 'ko_reach_r16';
UPDATE public.scoring_rules SET pts = 10, description = 'Team correctly predicted in QF'    WHERE rule_key = 'ko_reach_qf';
UPDATE public.scoring_rules SET pts = 15, description = 'Team correctly predicted in SF'    WHERE rule_key = 'ko_reach_sf';
UPDATE public.scoring_rules SET pts = 20, description = 'Team correctly predicted in Final' WHERE rule_key = 'ko_reach_final';
-- ko_champion stays at 25
