-- ============================================================
-- Disable auto-fetch cron to prevent API rate-limit exhaustion.
-- Run this in the Supabase SQL Editor (as superuser).
-- You will still be able to fetch manually from the Admin panel.
-- ============================================================

SELECT cron.unschedule('fetch-wc-results-every-5min');
