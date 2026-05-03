-- Cron auth fix: rewrite scheduled jobs to send `x-cron-secret` header so Edge
-- Functions can verify cron-triggered invocations using the CRON_SECRET env
-- (the previously-hardcoded service-role JWT no longer matches the rotated
-- SUPABASE_SERVICE_ROLE_KEY env value, causing every cron call to 401).
--
-- The Authorization header still carries the legacy service-role JWT to
-- satisfy the Functions gateway's JWT check; per-function authorization is
-- done via x-cron-secret.

do $$
declare
  cron_secret text := current_setting('app.cron_secret', true);
  gateway_jwt text := current_setting('app.cron_gateway_jwt', true);
  base_url    text := current_setting('app.functions_base_url', true);
  jobs jsonb := '[
    {"name":"ingest-all-signals",   "schedule":"*/15 * * * *", "fn":"ingest-signals"},
    {"name":"poll-generation-jobs", "schedule":"* * * * *",    "fn":"poll-job-status"},
    {"name":"archive-old-signals",  "schedule":"0 2 * * *",    "fn":"archive-old-signals"},
    {"name":"cleanup-apify-signals","schedule":"0 * * * *",    "fn":"cleanup-apify-signals"},
    {"name":"reset-monthly-quotas", "schedule":"0 0 1 * *",    "fn":"reset-monthly-quotas"}
  ]'::jsonb;
  j jsonb;
  cmd text;
begin
  if cron_secret is null or gateway_jwt is null or base_url is null then
    raise notice 'Skipping cron rewrite — set app.cron_secret, app.cron_gateway_jwt, app.functions_base_url first';
    return;
  end if;

  for j in select * from jsonb_array_elements(jobs) loop
    cmd := format(
      $f$SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Authorization','Bearer %s','Content-Type','application/json','x-cron-secret', %L),
        body := '{}'::jsonb
      ) AS request_id$f$,
      base_url || (j->>'fn'),
      gateway_jwt,
      cron_secret
    );

    perform cron.unschedule((j->>'name'));
    perform cron.schedule((j->>'name'), (j->>'schedule'), cmd);
  end loop;
end $$;
