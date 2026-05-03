-- Add email column to org_members for invite tracking (v1 approach)
ALTER TABLE org_members ADD COLUMN IF NOT EXISTS email text;

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_org_members_email ON org_members(email);

-- Ensure orgs has byok_mode column (already present but confirm constraint)
-- byok_mode already exists from 0009

-- Add estimated_cost_usd alias view — llm_usage_events uses cost_usd
-- Add estimated_cost_usd column if needed
ALTER TABLE llm_usage_events ADD COLUMN IF NOT EXISTS estimated_cost_usd numeric(12,8);

-- Copy existing cost_usd values to estimated_cost_usd
UPDATE llm_usage_events SET estimated_cost_usd = cost_usd WHERE estimated_cost_usd IS NULL;

-- RLS: org_members — allow members to read their own org's members
-- (existing policies cover this via org_isolation_select)

-- Ensure org_members has unique constraint on (org_id, user_id) for upsert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'org_members_org_id_user_id_key'
  ) THEN
    ALTER TABLE org_members ADD CONSTRAINT org_members_org_id_user_id_key UNIQUE (org_id, user_id);
  END IF;
END $$;

-- Ensure org_provider_api_keys unique constraint for upsert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'org_provider_api_keys_org_id_provider_key_key'
  ) THEN
    ALTER TABLE org_provider_api_keys ADD CONSTRAINT org_provider_api_keys_org_id_provider_key_key UNIQUE (org_id, provider_key);
  END IF;
END $$;

-- Ensure org_model_preferences unique constraint for upsert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'org_model_preferences_org_id_step_key_key'
  ) THEN
    ALTER TABLE org_model_preferences ADD CONSTRAINT org_model_preferences_org_id_step_key_key UNIQUE (org_id, step_key);
  END IF;
END $$;
