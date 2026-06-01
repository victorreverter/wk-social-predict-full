-- ────────────────────────────────────────────────────────────────────────────
-- Auto-fetch World Cup results via pg_cron (every 5 minutes)
-- Runs the fetch-wc-results edge function automatically during the tournament.
-- The edge function itself has a tournament-window guard, so this is a
-- safe no-op outside June 11 – July 20, 2026.
--
-- Run this SQL in the Supabase SQL Editor (one time, as superuser).
-- Requires Supabase Pro or higher (pg_cron + pg_net are Pro features).
-- ────────────────────────────────────────────────────────────────────────────

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── Wrapper function ────────────────────────────────────────────────────────
create or replace function public.cron_fetch_wc_results()
returns void
language plpgsql
security definer
as $$
declare
  v_url   text := 'https://xrgtoduqrrmfmyxduhab.supabase.co/functions/v1/fetch-wc-results';
  v_key   text := current_setting('app.settings.service_role_key', true);
  v_today date := current_date;
  v_start date := date '2026-06-11';
  v_end   date := date '2026-07-20';
  v_request_id bigint;
begin
  -- Tournament window guard: skip silently outside the World Cup
  if v_today < v_start or v_today > v_end then
    return;
  end if;

  -- Fire-and-forget HTTP POST to the edge function.
  -- The edge function reads the API key from its own env, so we just need
  -- a valid Supabase service role key to invoke it.
  select net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || coalesce(v_key, '')
    ),
    body    := jsonb_build_object('dateFrom', to_char(v_start, 'YYYY-MM-DD'),
                                  'dateTo',   to_char(v_end,   'YYYY-MM-DD'))
  ) into v_request_id;
exception
  when others then
    -- Log to football_data_api_log if possible, otherwise swallow
    begin
      insert into public.football_data_api_log (endpoint, status_code, response_ms, error_message)
      values (v_url, 500, 0, 'cron_fetch_wc_results: ' || sqlerrm);
    exception when others then
      null;
    end;
end;
$$;

-- ── Schedule: every 5 minutes ──────────────────────────────────────────────
-- cron.schedule(name, schedule, command)
select cron.schedule(
  'fetch-wc-results-every-5min',
  '*/5 * * * *',
  $$select public.cron_fetch_wc_results();$$
);
