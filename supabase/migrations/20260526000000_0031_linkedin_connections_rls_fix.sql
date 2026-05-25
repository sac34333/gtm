-- Fix RLS policies on org_linkedin_connections, campaign_chat_messages, and org_chat_usage
-- to use current_org_id() instead of auth.jwt() -> 'app_metadata' ->> 'org_id'.
-- The raw JWT claim is stale on first page load (JWT isn't refreshed until after org selection),
-- causing "LinkedIn not connected" banner flickering and empty chat history on first load.

-- ── org_linkedin_connections: make ad_account_urn optional ──
ALTER TABLE public.org_linkedin_connections
  ALTER COLUMN ad_account_urn DROP NOT NULL;

-- Drop the format CHECK that requires all rows to have a URN value
ALTER TABLE public.org_linkedin_connections
  DROP CONSTRAINT IF EXISTS linkedin_ad_account_format;

-- Add a weaker check: if ad_account_urn IS provided, it must match the format
ALTER TABLE public.org_linkedin_connections
  ADD CONSTRAINT linkedin_ad_account_format
  CHECK (ad_account_urn IS NULL OR ad_account_urn ~ '^urn:li:sponsoredAccount:[0-9]+$');

-- ── org_linkedin_connections: fix RLS ──
DROP POLICY IF EXISTS org_linkedin_select ON public.org_linkedin_connections;
DROP POLICY IF EXISTS org_linkedin_insert ON public.org_linkedin_connections;
DROP POLICY IF EXISTS org_linkedin_update ON public.org_linkedin_connections;
DROP POLICY IF EXISTS org_linkedin_delete ON public.org_linkedin_connections;

CREATE POLICY org_linkedin_select ON public.org_linkedin_connections
  FOR SELECT USING (org_id IN (SELECT current_org_id()));
CREATE POLICY org_linkedin_insert ON public.org_linkedin_connections
  FOR INSERT WITH CHECK (org_id IN (SELECT current_org_id()));
CREATE POLICY org_linkedin_update ON public.org_linkedin_connections
  FOR UPDATE USING (org_id IN (SELECT current_org_id()));
CREATE POLICY org_linkedin_delete ON public.org_linkedin_connections
  FOR DELETE USING (org_id IN (SELECT current_org_id()));

-- ── campaign_chat_messages: fix RLS ──
DROP POLICY IF EXISTS chat_msg_select ON public.campaign_chat_messages;
CREATE POLICY chat_msg_select ON public.campaign_chat_messages
  FOR SELECT USING (org_id IN (SELECT current_org_id()));

-- ── org_chat_usage: fix RLS ──
DROP POLICY IF EXISTS chat_usage_select ON public.org_chat_usage;
CREATE POLICY chat_usage_select ON public.org_chat_usage
  FOR SELECT USING (org_id IN (SELECT current_org_id()));