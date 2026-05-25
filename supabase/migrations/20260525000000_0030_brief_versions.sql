-- 0030_brief_versions.sql
-- Stores version history for campaign briefs so users can view/compare previous versions.

CREATE TABLE IF NOT EXISTS public.brief_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaign_briefs(id) ON DELETE CASCADE,
  version     integer NOT NULL DEFAULT 1,
  brief_data  jsonb,
  pdf_url     text,
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE(campaign_id, version)
);

-- RLS
ALTER TABLE public.brief_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brief_versions_org_read" ON public.brief_versions
  FOR SELECT USING (org_id IN (SELECT current_org_id()));

CREATE POLICY "brief_versions_org_insert" ON public.brief_versions
  FOR INSERT WITH CHECK (org_id IN (SELECT current_org_id()));

-- Index for listing versions by campaign
CREATE INDEX IF NOT EXISTS idx_brief_versions_campaign ON public.brief_versions(campaign_id, version DESC);