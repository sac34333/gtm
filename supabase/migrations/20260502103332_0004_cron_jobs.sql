-- Migration 0004: pg_cron jobs for scheduled tasks
-- Applied: 2026-05-02T10:33:32Z (version 20260502103332)

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Signal ingestion: every hour
SELECT cron.schedule(
  'ingest-signals-hourly',
  '0 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/ingest-signals',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || current_setting('app.service_role_key') || '"}',
    body := '{}'
  )$$
);

-- Archive old signals: daily at 2am UTC
SELECT cron.schedule(
  'archive-old-signals-daily',
  '0 2 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/archive-old-signals',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || current_setting('app.service_role_key') || '"}',
    body := '{}'
  )$$
);

-- Reset monthly quotas: 1st of each month at midnight UTC
SELECT cron.schedule(
  'reset-monthly-quotas',
  '0 0 1 * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/reset-monthly-quotas',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || current_setting('app.service_role_key') || '"}',
    body := '{}'
  )$$
);

-- Cleanup Apify signals: daily at 3am UTC
SELECT cron.schedule(
  'cleanup-apify-signals-daily',
  '0 3 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/cleanup-apify-signals',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || current_setting('app.service_role_key') || '"}',
    body := '{}'
  )$$
);

-- Poll pending generation jobs: every 2 minutes
SELECT cron.schedule(
  'poll-job-status-frequent',
  '*/2 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/poll-job-status',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || current_setting('app.service_role_key') || '"}',
    body := '{}'
  )$$
);
