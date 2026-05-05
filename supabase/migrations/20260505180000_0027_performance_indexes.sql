-- 0027_performance_indexes.sql
-- Adds 7 indexes on hot columns + unindexed FKs identified by pre-handoff audit
-- (testing/FINDINGS-2026-05-05.md §3.4).
--
-- IF NOT EXISTS guards make this safely re-runnable. Plain CREATE INDEX (not
-- CONCURRENTLY) so the migration stays transactional — table sizes are small
-- enough that the brief AccessShareLock is negligible.

-- Hot-path query columns
CREATE INDEX IF NOT EXISTS idx_signals_created_at
  ON public.signals (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_status
  ON public.generation_jobs (status);

CREATE INDEX IF NOT EXISTS idx_llm_usage_events_created_at
  ON public.llm_usage_events (created_at DESC);

-- Unindexed foreign keys (Supabase advisor)
CREATE INDEX IF NOT EXISTS idx_icp_enrichment_runs_user_id
  ON public.icp_enrichment_runs (user_id);

CREATE INDEX IF NOT EXISTS idx_outreach_copies_prospect_id
  ON public.outreach_copies (prospect_id);

CREATE INDEX IF NOT EXISTS idx_prospects_last_campaign_id
  ON public.prospects (last_campaign_id);

CREATE INDEX IF NOT EXISTS idx_signals_feed_config_id
  ON public.signals (feed_config_id);
