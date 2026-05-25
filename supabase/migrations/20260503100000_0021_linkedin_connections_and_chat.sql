-- LinkedIn connections (one per org, encrypted access token)
CREATE TABLE IF NOT EXISTS public.org_linkedin_connections (
  org_id uuid PRIMARY KEY REFERENCES public.orgs(id) ON DELETE CASCADE,
  encrypted_access_token text NOT NULL,
  ad_account_urn text NOT NULL,
  account_name text,
  granted_scopes text[] DEFAULT '{}',
  token_expires_at timestamptz,
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT linkedin_ad_account_format CHECK (ad_account_urn ~ '^urn:li:sponsoredAccount:[0-9]+$')
);

ALTER TABLE public.org_linkedin_connections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY org_linkedin_select ON public.org_linkedin_connections
    FOR SELECT USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY org_linkedin_insert ON public.org_linkedin_connections
    FOR INSERT WITH CHECK (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY org_linkedin_update ON public.org_linkedin_connections
    FOR UPDATE USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY org_linkedin_delete ON public.org_linkedin_connections
    FOR DELETE USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Chat messages per campaign
CREATE TABLE IF NOT EXISTS public.campaign_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaign_briefs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL CHECK (char_length(content) <= 20000),
  prompt_tokens int,
  completion_tokens int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaign_chat_messages_campaign_idx
  ON public.campaign_chat_messages (campaign_id, created_at);
CREATE INDEX IF NOT EXISTS campaign_chat_messages_org_idx
  ON public.campaign_chat_messages (org_id, created_at);

ALTER TABLE public.campaign_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_msg_select ON public.campaign_chat_messages
  FOR SELECT USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);
-- INSERT/UPDATE/DELETE only via service role from the campaign-chat Edge Function
-- (no RLS policy = blocked by default).

-- Daily chat usage counter for rate limiting / cost capping
CREATE TABLE IF NOT EXISTS public.org_chat_usage (
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  period_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  message_count int NOT NULL DEFAULT 0,
  total_tokens int NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  PRIMARY KEY (org_id, period_date)
);

ALTER TABLE public.org_chat_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_usage_select ON public.org_chat_usage
  FOR SELECT USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);
-- INSERT/UPDATE only via service role.
