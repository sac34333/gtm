-- Migration 0009: Schema corrections — campaign system, generation jobs additions
-- Applied: 2026-05-02T12:29:35Z (version 20260502122935)

-- Campaign briefs: add campaign management columns
ALTER TABLE campaign_briefs ADD COLUMN IF NOT EXISTS campaign_type text;
ALTER TABLE campaign_briefs ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE campaign_briefs ADD COLUMN IF NOT EXISTS channel_mix jsonb DEFAULT '[]';
ALTER TABLE campaign_briefs ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE campaign_briefs ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE campaign_briefs ADD COLUMN IF NOT EXISTS brief_data jsonb;

-- Generation jobs: add extended tracking columns
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS signal_id uuid REFERENCES signals(id) ON DELETE SET NULL;
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS asset_type text;
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS prompt_tags jsonb;
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS openrouter_job_id text;
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS generation_time_ms integer;

-- LLM usage events: add extended tracking columns
ALTER TABLE llm_usage_events ADD COLUMN IF NOT EXISTS key_source_used text;
ALTER TABLE llm_usage_events ADD COLUMN IF NOT EXISTS success boolean DEFAULT true;
ALTER TABLE llm_usage_events ADD COLUMN IF NOT EXISTS error_code text;

-- Outreach copies: add campaign and approval tracking
ALTER TABLE outreach_copies ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES campaign_briefs(id) ON DELETE SET NULL;
ALTER TABLE outreach_copies ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE outreach_copies ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Generation feedback: add extra fields
ALTER TABLE generation_feedback ADD COLUMN IF NOT EXISTS thumbs text;
ALTER TABLE generation_feedback ADD COLUMN IF NOT EXISTS tags_changed jsonb;
ALTER TABLE generation_feedback ADD COLUMN IF NOT EXISTS regenerated boolean DEFAULT false;

-- Prospects: additional enrichment fields
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS company_domain text;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS enrichment_source text;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new';

-- Org members: invite tracking
ALTER TABLE org_members ADD COLUMN IF NOT EXISTS invited_by uuid;
ALTER TABLE org_members ADD COLUMN IF NOT EXISTS joined_at timestamptz;

-- Available models: extended metadata
ALTER TABLE available_models ADD COLUMN IF NOT EXISTS output_modalities text[];
ALTER TABLE available_models ADD COLUMN IF NOT EXISTS compatible_step_keys text[];
ALTER TABLE available_models ADD COLUMN IF NOT EXISTS recommendation_text text;
ALTER TABLE available_models ADD COLUMN IF NOT EXISTS requires_paid_plan boolean DEFAULT false;
ALTER TABLE available_models ADD COLUMN IF NOT EXISTS estimated_time_seconds integer;
ALTER TABLE available_models ADD COLUMN IF NOT EXISTS release_date date;
ALTER TABLE available_models ADD COLUMN IF NOT EXISTS cost_per_1k_input_tokens numeric;
ALTER TABLE available_models ADD COLUMN IF NOT EXISTS cost_per_1k_output_tokens numeric;

-- Org model preferences: model label and updated_by
ALTER TABLE org_model_preferences ADD COLUMN IF NOT EXISTS model_label text;
ALTER TABLE org_model_preferences ADD COLUMN IF NOT EXISTS updated_by uuid;

-- Org provider api keys: key label
ALTER TABLE org_provider_api_keys ADD COLUMN IF NOT EXISTS key_label text;

-- Model providers: docs url
ALTER TABLE model_providers ADD COLUMN IF NOT EXISTS docs_url text;

-- Orgs: BYOK and country
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS country_code text;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS byok_mode boolean NOT NULL DEFAULT false;

-- Additional indexes
CREATE INDEX IF NOT EXISTS generation_jobs_signal_id_idx ON generation_jobs(signal_id);
CREATE INDEX IF NOT EXISTS outreach_copies_campaign_id_prospect_idx ON outreach_copies(campaign_id, prospect_id);
CREATE UNIQUE INDEX IF NOT EXISTS outreach_copies_upsert_idx ON outreach_copies(org_id, campaign_id, prospect_id, platform)
  WHERE campaign_id IS NOT NULL;
