-- Add pred_result column to user_predictions_knockout_structure
-- This is backward-compatible (defaults to null).
-- Preserves Easy Mode result values (HOME_WIN / AWAY_WIN / DRAW)
-- independently of the exact score.

alter table if exists public.user_predictions_knockout_structure
add column if not exists pred_result text;
