-- ────────────────────────────────────────────────────────────────────────────
-- 20260601_auto_fetch_cron.sql
-- Auto-fetch World Cup results via pg_cron (every 5 minutes).
-- The edge function has a tournament-window guard (June 11 – July 20, 2026),
-- so the cron job is a safe no-op on off-days.
--
-- Run once in the Supabase SQL Editor as a superuser.
-- Requires Supabase Pro or higher (pg_cron + pg_net are Pro features).
-- ────────────────────────────────────────────────────────────────────────────

create extension if not exists pg_cron;
create extension if not exists pg_net;

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
begin
  if v_today < v_start or v_today > v_end then
    return;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || coalesce(v_key, '')
    ),
    body    := jsonb_build_object('dateFrom', to_char(v_start, 'YYYY-MM-DD'),
                                  'dateTo',   to_char(v_end,   'YYYY-MM-DD'))
  );
exception
  when others then
    begin
      insert into public.football_data_api_log (endpoint, status_code, response_ms, error_message)
      values (v_url, 500, 0, 'cron_fetch_wc_results: ' || sqlerrm);
    exception when others then
      null;
    end;
end;
$$;

do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'fetch-wc-results-every-5min'
  ) then
    perform cron.schedule(
      'fetch-wc-results-every-5min',
      '*/5 * * * *',
      $cmd$select public.cron_fetch_wc_results();$cmd$
    );
  end if;
end $$;
