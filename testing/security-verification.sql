-- ============================================================================
-- GTM Engine — Security & Health Verification Script
-- Run in Supabase SQL Editor against the project ycsfossrrntwhegmyrze.
-- All blocks are read-only. Each section prints a result table you can eyeball.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RLS enabled on every table in public
-- Expected: rls_enabled = true for all 20 tables. Any 'false' is a P0 finding.
-- ----------------------------------------------------------------------------
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  CASE WHEN rowsecurity THEN '✅ OK' ELSE '❌ RLS DISABLED' END AS status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ----------------------------------------------------------------------------
-- 2. Tables with org_id column but missing one or more CRUD policies
-- Expected: every org-scoped table has 4 policies (select/insert/update/delete).
-- ----------------------------------------------------------------------------
WITH org_tables AS (
  SELECT DISTINCT table_name
  FROM information_schema.columns
  WHERE table_schema = 'public' AND column_name = 'org_id'
),
policy_counts AS (
  SELECT tablename, count(*) FILTER (WHERE cmd = 'SELECT') AS sel,
         count(*) FILTER (WHERE cmd = 'INSERT') AS ins,
         count(*) FILTER (WHERE cmd = 'UPDATE') AS upd,
         count(*) FILTER (WHERE cmd = 'DELETE') AS del
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename
)
SELECT
  o.table_name,
  COALESCE(p.sel, 0) AS sel,
  COALESCE(p.ins, 0) AS ins,
  COALESCE(p.upd, 0) AS upd,
  COALESCE(p.del, 0) AS del,
  CASE WHEN COALESCE(p.sel,0)>0 AND COALESCE(p.ins,0)>0
            AND COALESCE(p.upd,0)>0 AND COALESCE(p.del,0)>0
       THEN '✅ OK' ELSE '❌ MISSING POLICIES' END AS status
FROM org_tables o
LEFT JOIN policy_counts p ON p.tablename = o.table_name
ORDER BY o.table_name;

-- ----------------------------------------------------------------------------
-- 3. Cron jobs — all expected jobs present and active
-- Expected: 5 rows, all active=true.
-- ----------------------------------------------------------------------------
SELECT jobname, schedule, active,
       CASE WHEN active THEN '✅ OK' ELSE '❌ INACTIVE' END AS status
FROM cron.job
ORDER BY jobname;

-- ----------------------------------------------------------------------------
-- 4. Cron job most-recent runs — none should be in 'failed' state
-- ----------------------------------------------------------------------------
SELECT
  j.jobname,
  d.status,
  d.start_time,
  d.end_time,
  CASE WHEN d.status = 'succeeded' THEN '✅' ELSE '❌' END AS ok
FROM cron.job j
LEFT JOIN LATERAL (
  SELECT status, start_time, end_time
  FROM cron.job_run_details
  WHERE jobid = j.jobid
  ORDER BY start_time DESC
  LIMIT 1
) d ON true
ORDER BY j.jobname;

-- ----------------------------------------------------------------------------
-- 5. Storage buckets — none should be public
-- ----------------------------------------------------------------------------
SELECT name, public,
       CASE WHEN public = false THEN '✅ private' ELSE '❌ PUBLIC' END AS status
FROM storage.buckets
ORDER BY name;

-- ----------------------------------------------------------------------------
-- 6. Encrypted-at-rest columns — values must NOT look like API keys
-- Spot-check shape: should be base64-ish ciphertext, NOT starting with sk-/pcsk-/etc.
-- ----------------------------------------------------------------------------
SELECT
  'org_provider_api_keys' AS source,
  count(*) AS total_rows,
  count(*) FILTER (WHERE encrypted_key ~* '^(sk-|pcsk-|fal-|nrk_|nwsk_)') AS plaintext_leaks,
  CASE WHEN count(*) FILTER (WHERE encrypted_key ~* '^(sk-|pcsk-|fal-|nrk_|nwsk_)') = 0
       THEN '✅ all encrypted' ELSE '❌ PLAINTEXT FOUND' END AS status
FROM org_provider_api_keys
UNION ALL
SELECT
  'org_api_keys',
  count(*),
  count(*) FILTER (WHERE encrypted_key ~* '^(sk-|pcsk-|fal-|nrk_|nwsk_)'),
  CASE WHEN count(*) FILTER (WHERE encrypted_key ~* '^(sk-|pcsk-|fal-|nrk_|nwsk_)') = 0
       THEN '✅ all encrypted' ELSE '❌ PLAINTEXT FOUND' END
FROM org_api_keys;

-- ----------------------------------------------------------------------------
-- 7. Hot-path indexes that should exist
-- ----------------------------------------------------------------------------
WITH expected AS (
  SELECT * FROM (VALUES
    ('signals',          'org_id'),
    ('signals',          'created_at'),
    ('prospects',        'org_id'),
    ('generation_jobs',  'org_id'),
    ('generation_jobs',  'status'),
    ('campaign_briefs',  'org_id'),
    ('campaign_prospects','campaign_id'),
    ('outreach_copies',  'campaign_id'),
    ('llm_usage_events', 'org_id'),
    ('llm_usage_events', 'created_at')
  ) AS t(tbl, col)
)
SELECT
  e.tbl,
  e.col,
  CASE WHEN EXISTS (
    SELECT 1
    FROM pg_indexes i
    WHERE i.schemaname = 'public'
      AND i.tablename = e.tbl
      AND i.indexdef ILIKE '%(' || e.col || '%'
  ) THEN '✅ indexed' ELSE '⚠️  missing index' END AS status
FROM expected e
ORDER BY e.tbl, e.col;

-- ----------------------------------------------------------------------------
-- 8. Cross-tenant data leak smoke check
-- For every table with org_id, count distinct orgs. Should match expected dev/test count.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  rec record;
  cnt int;
BEGIN
  RAISE NOTICE '--- Distinct org_id per table ---';
  FOR rec IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema='public' AND column_name='org_id'
    ORDER BY table_name
  LOOP
    EXECUTE format('SELECT count(DISTINCT org_id) FROM public.%I', rec.table_name) INTO cnt;
    RAISE NOTICE '%  => % orgs', rpad(rec.table_name, 32), cnt;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 9. Quota integrity — image_used / video_used must not exceed quota
-- ----------------------------------------------------------------------------
SELECT
  id, name, plan_tier,
  image_used, image_quota,
  video_used, video_quota,
  CASE
    WHEN image_used > image_quota OR video_used > video_quota
    THEN '❌ OVER QUOTA' ELSE '✅ within quota' END AS status
FROM orgs
ORDER BY name;

-- ----------------------------------------------------------------------------
-- 10. Stale generation jobs (stuck in processing > 30 min)
-- ----------------------------------------------------------------------------
SELECT id, org_id, status, created_at, updated_at,
       now() - updated_at AS age,
       '⚠️  stale' AS status
FROM generation_jobs
WHERE status IN ('pending','processing')
  AND updated_at < now() - interval '30 minutes'
ORDER BY updated_at ASC
LIMIT 20;

-- ----------------------------------------------------------------------------
-- 11. SECURITY DEFINER functions — verify search_path is locked
-- ----------------------------------------------------------------------------
SELECT
  n.nspname AS schema,
  p.proname AS function,
  p.prosecdef AS security_definer,
  pg_catalog.array_to_string(p.proconfig, ', ') AS config,
  CASE
    WHEN p.prosecdef AND (p.proconfig IS NULL OR NOT EXISTS (
      SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'
    )) THEN '⚠️  mutable search_path'
    ELSE '✅ OK'
  END AS status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY function;

-- ----------------------------------------------------------------------------
-- 12. Available models — at least one default per step_key
-- ----------------------------------------------------------------------------
SELECT
  default_step_key,
  count(*) AS models,
  CASE WHEN count(*) > 0 THEN '✅' ELSE '❌ no default' END AS status
FROM available_models
WHERE default_step_key IS NOT NULL
GROUP BY default_step_key
ORDER BY default_step_key;

-- ============================================================================
-- END
-- ============================================================================
