-- Track every ICP enrichment run so users can review their history
-- (criteria used, model, prospects found, when, by whom).
CREATE TABLE IF NOT EXISTS icp_enrichment_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criteria        jsonb NOT NULL,
  model_id        text,
  source          text NOT NULL DEFAULT 'web_search',
  max_results     integer NOT NULL,
  prospects_found integer NOT NULL DEFAULT 0,
  prospect_ids    uuid[],
  warning         text,
  status          text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','failed')),
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS icp_enrichment_runs_org_created_idx
  ON icp_enrichment_runs (org_id, created_at DESC);

ALTER TABLE icp_enrichment_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON icp_enrichment_runs
  FOR SELECT USING (org_id = public.current_org_id());
CREATE POLICY "org_isolation_insert" ON icp_enrichment_runs
  FOR INSERT WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "org_isolation_update" ON icp_enrichment_runs
  FOR UPDATE USING (org_id = public.current_org_id());
CREATE POLICY "org_isolation_delete" ON icp_enrichment_runs
  FOR DELETE USING (org_id = public.current_org_id());
