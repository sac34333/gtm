-- Production hardening: move vector extension, add covering indexes for FKs
-- Note: pg_net does not support SET SCHEMA, leaving in public

CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION vector SET SCHEMA extensions;

-- Covering indexes for FKs flagged by performance advisor
CREATE INDEX IF NOT EXISTS idx_campaign_briefs_org_id ON public.campaign_briefs(org_id);
CREATE INDEX IF NOT EXISTS idx_campaign_briefs_job_id ON public.campaign_briefs(job_id);
CREATE INDEX IF NOT EXISTS idx_generation_feedback_org_id ON public.generation_feedback(org_id);
CREATE INDEX IF NOT EXISTS idx_generation_feedback_job_id ON public.generation_feedback(job_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_org_id ON public.generation_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_parent_job_id ON public.generation_jobs(parent_job_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_events_org_id ON public.llm_usage_events(org_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_events_job_id ON public.llm_usage_events(job_id);
CREATE INDEX IF NOT EXISTS idx_org_api_keys_org_id ON public.org_api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_invited_by ON public.org_members(invited_by);
CREATE INDEX IF NOT EXISTS idx_org_model_preferences_updated_by ON public.org_model_preferences(updated_by);
CREATE INDEX IF NOT EXISTS idx_outreach_copies_approved_by ON public.outreach_copies(approved_by);
CREATE INDEX IF NOT EXISTS idx_outreach_copies_campaign_id ON public.outreach_copies(campaign_id);
CREATE INDEX IF NOT EXISTS idx_outreach_copies_job_id ON public.outreach_copies(job_id);
