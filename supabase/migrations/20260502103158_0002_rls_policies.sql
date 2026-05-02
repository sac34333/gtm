-- Migration 0002: RLS policies (org isolation)
-- Applied: 2026-05-02T10:31:58Z (version 20260502103158)

-- Helper: extract org_id from JWT app_metadata
CREATE OR REPLACE FUNCTION auth_org_id() RETURNS uuid AS $$
  SELECT ((auth.jwt() -> 'app_metadata') ->> 'org_id')::uuid;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─── ORGS ────────────────────────────────────────────────────────────────────
CREATE POLICY "org_isolation_select" ON orgs
  FOR SELECT USING (id = auth_org_id());

-- ─── ORG MEMBERS ─────────────────────────────────────────────────────────────
CREATE POLICY "org_isolation_select" ON org_members FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_insert" ON org_members FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "org_isolation_update" ON org_members FOR UPDATE USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_delete" ON org_members FOR DELETE USING (org_id = auth_org_id());

-- ─── BRAND CONTEXTS ──────────────────────────────────────────────────────────
CREATE POLICY "org_isolation_select" ON brand_contexts FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_insert" ON brand_contexts FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "org_isolation_update" ON brand_contexts FOR UPDATE USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_delete" ON brand_contexts FOR DELETE USING (org_id = auth_org_id());

-- ─── FEED CONFIGS ────────────────────────────────────────────────────────────
CREATE POLICY "org_isolation_select" ON feed_configs FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_insert" ON feed_configs FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "org_isolation_update" ON feed_configs FOR UPDATE USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_delete" ON feed_configs FOR DELETE USING (org_id = auth_org_id());

-- ─── SIGNALS ─────────────────────────────────────────────────────────────────
CREATE POLICY "org_isolation_select" ON signals FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_insert" ON signals FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "org_isolation_update" ON signals FOR UPDATE USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_delete" ON signals FOR DELETE USING (org_id = auth_org_id());

-- ─── ORG API KEYS ────────────────────────────────────────────────────────────
CREATE POLICY "org_isolation_select" ON org_api_keys FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_insert" ON org_api_keys FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "org_isolation_update" ON org_api_keys FOR UPDATE USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_delete" ON org_api_keys FOR DELETE USING (org_id = auth_org_id());

-- ─── GENERATION JOBS ─────────────────────────────────────────────────────────
CREATE POLICY "org_isolation_select" ON generation_jobs FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_insert" ON generation_jobs FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "org_isolation_update" ON generation_jobs FOR UPDATE USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_delete" ON generation_jobs FOR DELETE USING (org_id = auth_org_id());

-- ─── GENERATION FEEDBACK ─────────────────────────────────────────────────────
CREATE POLICY "org_isolation_select" ON generation_feedback FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_insert" ON generation_feedback FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "org_isolation_update" ON generation_feedback FOR UPDATE USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_delete" ON generation_feedback FOR DELETE USING (org_id = auth_org_id());

-- ─── PROSPECTS ───────────────────────────────────────────────────────────────
CREATE POLICY "org_isolation_select" ON prospects FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_insert" ON prospects FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "org_isolation_update" ON prospects FOR UPDATE USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_delete" ON prospects FOR DELETE USING (org_id = auth_org_id());

-- ─── OUTREACH COPIES ─────────────────────────────────────────────────────────
CREATE POLICY "org_isolation_select" ON outreach_copies FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_insert" ON outreach_copies FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "org_isolation_update" ON outreach_copies FOR UPDATE USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_delete" ON outreach_copies FOR DELETE USING (org_id = auth_org_id());

-- ─── CAMPAIGN BRIEFS ─────────────────────────────────────────────────────────
CREATE POLICY "org_isolation_select" ON campaign_briefs FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_insert" ON campaign_briefs FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "org_isolation_update" ON campaign_briefs FOR UPDATE USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_delete" ON campaign_briefs FOR DELETE USING (org_id = auth_org_id());

-- ─── CAMPAIGN PROSPECTS ──────────────────────────────────────────────────────
CREATE POLICY "org_isolation_select" ON campaign_prospects FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_insert" ON campaign_prospects FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "org_isolation_update" ON campaign_prospects FOR UPDATE USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_delete" ON campaign_prospects FOR DELETE USING (org_id = auth_org_id());

-- ─── ORG MODEL PREFERENCES ───────────────────────────────────────────────────
CREATE POLICY "org_isolation_select" ON org_model_preferences FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_insert" ON org_model_preferences FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "org_isolation_update" ON org_model_preferences FOR UPDATE USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_delete" ON org_model_preferences FOR DELETE USING (org_id = auth_org_id());

-- ─── ORG PROVIDER API KEYS ───────────────────────────────────────────────────
CREATE POLICY "org_isolation_select" ON org_provider_api_keys FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_insert" ON org_provider_api_keys FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "org_isolation_update" ON org_provider_api_keys FOR UPDATE USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_delete" ON org_provider_api_keys FOR DELETE USING (org_id = auth_org_id());

-- ─── LLM USAGE EVENTS ────────────────────────────────────────────────────────
CREATE POLICY "org_isolation_select" ON llm_usage_events FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_insert" ON llm_usage_events FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "org_isolation_update" ON llm_usage_events FOR UPDATE USING (org_id = auth_org_id());
CREATE POLICY "org_isolation_delete" ON llm_usage_events FOR DELETE USING (org_id = auth_org_id());

-- ─── MODEL PROVIDERS (read-only for all authenticated users) ─────────────────
CREATE POLICY "authenticated_read" ON model_providers
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── AVAILABLE MODELS (read-only for all authenticated users) ────────────────
CREATE POLICY "authenticated_read" ON available_models
  FOR SELECT USING (auth.role() = 'authenticated');
