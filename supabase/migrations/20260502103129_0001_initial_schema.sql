-- Migration 0001: Initial schema
-- Applied: 2026-05-02T10:31:29Z (version 20260502103129)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─── ORGS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orgs (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      text NOT NULL,
  slug                      text NOT NULL UNIQUE,
  plan_tier                 text NOT NULL DEFAULT 'starter',
  seat_limit                integer NOT NULL DEFAULT 2,
  image_quota               integer NOT NULL DEFAULT 50,
  video_quota               integer NOT NULL DEFAULT 5,
  image_used                integer NOT NULL DEFAULT 0,
  video_used                integer NOT NULL DEFAULT 0,
  quota_reset_at            timestamptz,
  signal_ingestion_enabled  boolean NOT NULL DEFAULT false,
  signal_ingestion_frequency text NOT NULL DEFAULT 'daily',
  last_signal_ingestion_at  timestamptz,
  dodo_customer_id          text,
  dodo_subscription_id      text,
  onboarding_complete       boolean NOT NULL DEFAULT false,
  country_code              text,
  byok_mode                 boolean NOT NULL DEFAULT false,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- ─── ORG MEMBERS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  role        text NOT NULL,
  status      text NOT NULL DEFAULT 'active',
  invited_by  uuid,
  joined_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

-- ─── BRAND CONTEXTS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brand_contexts (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  company_name                text,
  country_code                text,
  industry_sector             text,
  company_size                text,
  website_url                 text,
  founding_year               integer,
  one_sentence_pitch          text,
  extended_description        text,
  products_services           jsonb,
  revenue_model               text,
  target_geographies          jsonb,
  target_industries           jsonb,
  target_company_sizes        jsonb,
  decision_maker_titles       jsonb,
  tone_formal_conversational  integer,
  tone_conservative_provocative integer,
  tone_corporate_human        integer,
  tone_data_story             integer,
  tone_safe_bold              integer,
  sentence_length             text,
  jargon_level                text,
  emoji_usage                 text,
  cta_style                   text,
  voice_examples              jsonb,
  brand_colours               jsonb,
  logo_url                    text,
  brand_guidelines_url        text,
  brand_guidelines_text       text,
  reference_images            jsonb,
  anti_reference_images       jsonb,
  visual_style                text,
  dark_light_preference       text,
  busy_minimal                text,
  human_faces                 boolean,
  location_style              text,
  active_themes               jsonb,
  competitor_names            jsonb,
  primary_platform            text,
  secondary_platform          text,
  posts_per_week              integer,
  timezone                    text,
  topics_to_avoid             jsonb,
  phrases_to_avoid            jsonb,
  visual_styles_to_avoid      jsonb,
  sensitivities               text,
  last_icp_criteria           jsonb,
  brand_context_embedding     vector(1536),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id)
);

-- ─── FEED CONFIGS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feed_configs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  source_type      text NOT NULL,
  config           jsonb NOT NULL DEFAULT '{}',
  is_active        boolean NOT NULL DEFAULT true,
  last_fetched_at  timestamptz,
  source_url       text,
  source_label     text,
  keywords         text[] DEFAULT '{}',
  api_key_ref      text,
  error_count      integer DEFAULT 0,
  requires_api_key boolean DEFAULT false,
  auto_activated   boolean NOT NULL DEFAULT false,
  cron_expression  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── SIGNALS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS signals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  source_type      text NOT NULL,
  feed_config_id   uuid REFERENCES feed_configs(id) ON DELETE SET NULL,
  url              text,
  url_hash         text NOT NULL,
  headline         text,
  summary          text,
  published_at     timestamptz,
  author           text,
  raw_payload      jsonb,
  relevance_score  real,
  is_archived      boolean NOT NULL DEFAULT false,
  source_name      text,
  status           text NOT NULL DEFAULT 'unread',
  matched_themes   text[] DEFAULT '{}',
  tags             text[] DEFAULT '{}',
  dismissed_at     timestamptz,
  dismissed_by     uuid,
  scraped_at       timestamptz DEFAULT now(),
  matched_keywords text[] DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, url_hash)
);

-- ─── ORG API KEYS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_api_keys (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  key_name        text NOT NULL,
  encrypted_value text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, key_name)
);

-- ─── GENERATION JOBS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS generation_jobs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  step_key           text NOT NULL,
  status             text NOT NULL DEFAULT 'pending',
  model_id           text NOT NULL,
  provider_key       text NOT NULL,
  content_job_json   jsonb,
  output_url         text,
  result_metadata    jsonb,
  error_message      text,
  poll_count         integer NOT NULL DEFAULT 0,
  version            integer NOT NULL DEFAULT 1,
  parent_job_id      uuid REFERENCES generation_jobs(id) ON DELETE SET NULL,
  started_at         timestamptz,
  completed_at       timestamptz,
  created_by         uuid,
  signal_id          uuid REFERENCES signals(id) ON DELETE SET NULL,
  asset_type         text,
  prompt_tags        jsonb,
  openrouter_job_id  text,
  generation_time_ms integer,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ─── GENERATION FEEDBACK ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS generation_feedback (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  job_id         uuid NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL,
  rating         integer,
  feedback_text  text,
  thumbs         text,
  tags_changed   jsonb,
  regenerated    boolean DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ─── PROSPECTS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prospects (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  first_name         text,
  last_name          text,
  email              text,
  linkedin_url       text,
  job_title          text,
  company_name       text,
  company_description text,
  company_size       text,
  industry           text,
  location           text,
  enrichment_data    jsonb,
  icp_score          real,
  icp_fit_reason     text,
  company_domain     text,
  country            text,
  enrichment_source  text,
  status             text NOT NULL DEFAULT 'new',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ─── OUTREACH COPIES ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outreach_copies (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  prospect_id          uuid REFERENCES prospects(id) ON DELETE SET NULL,
  job_id               uuid REFERENCES generation_jobs(id) ON DELETE SET NULL,
  platform             text,
  subject              text,
  copy_text            text NOT NULL,
  personalisation_data jsonb,
  status               text NOT NULL DEFAULT 'draft',
  campaign_id          uuid,
  approved_by          uuid,
  approved_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ─── CAMPAIGN BRIEFS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_briefs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name          text NOT NULL,
  brief_text    text,
  pdf_url       text,
  signal_ids    jsonb,
  job_id        uuid REFERENCES generation_jobs(id) ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'draft',
  campaign_type text,
  description   text,
  channel_mix   jsonb DEFAULT '[]',
  start_date    date,
  end_date      date,
  brief_data    jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── CAMPAIGN PROSPECTS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_prospects (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  campaign_id  uuid NOT NULL REFERENCES campaign_briefs(id) ON DELETE CASCADE,
  prospect_id  uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'active',
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, prospect_id)
);

-- ─── MODEL PROVIDERS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS model_providers (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key           text NOT NULL UNIQUE,
  display_name           text NOT NULL,
  api_base_url           text NOT NULL,
  models_endpoint        text,
  platform_key_available boolean NOT NULL DEFAULT false,
  is_active              boolean NOT NULL DEFAULT true,
  docs_url               text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- ─── AVAILABLE MODELS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS available_models (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key             text NOT NULL,
  model_id                 text NOT NULL,
  model_label              text NOT NULL,
  model_type               text NOT NULL,
  cost_tier                text NOT NULL,
  key_source               text NOT NULL,
  default_for_step_key     text[],
  is_active                boolean NOT NULL DEFAULT true,
  is_recommended           boolean NOT NULL DEFAULT false,
  recommendation_order     integer,
  context_length           integer,
  max_output_tokens        integer,
  notes                    text,
  output_modalities        text[],
  compatible_step_keys     text[],
  recommendation_text      text,
  requires_paid_plan       boolean DEFAULT false,
  estimated_time_seconds   integer,
  release_date             date,
  cost_per_1k_input_tokens numeric,
  cost_per_1k_output_tokens numeric,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_key, model_id)
);

-- ─── ORG MODEL PREFERENCES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_model_preferences (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  step_key     text NOT NULL,
  model_id     text NOT NULL,
  provider_key text NOT NULL,
  model_label  text,
  updated_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, step_key)
);

-- ─── ORG PROVIDER API KEYS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_provider_api_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  provider_key  text NOT NULL,
  encrypted_key text NOT NULL,
  key_label     text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, provider_key)
);

-- ─── LLM USAGE EVENTS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS llm_usage_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  job_id           uuid REFERENCES generation_jobs(id) ON DELETE SET NULL,
  step_key         text NOT NULL,
  provider_key     text NOT NULL,
  model_id         text NOT NULL,
  prompt_tokens    integer,
  completion_tokens integer,
  total_tokens     integer,
  cost_usd         numeric,
  latency_ms       integer,
  langfuse_trace_id text,
  key_source_used  text,
  success          boolean DEFAULT true,
  error_code       text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS signals_org_id_idx ON signals(org_id);
CREATE INDEX IF NOT EXISTS signals_status_idx ON signals(org_id, status);
CREATE INDEX IF NOT EXISTS signals_url_hash_idx ON signals(url_hash);
CREATE INDEX IF NOT EXISTS generation_jobs_org_id_idx ON generation_jobs(org_id);
CREATE INDEX IF NOT EXISTS generation_jobs_status_idx ON generation_jobs(org_id, status);
CREATE INDEX IF NOT EXISTS prospects_org_id_idx ON prospects(org_id);
CREATE INDEX IF NOT EXISTS prospects_icp_score_idx ON prospects(org_id, icp_score DESC);
CREATE INDEX IF NOT EXISTS campaign_briefs_org_id_idx ON campaign_briefs(org_id);
CREATE INDEX IF NOT EXISTS campaign_prospects_campaign_id_idx ON campaign_prospects(campaign_id);
CREATE INDEX IF NOT EXISTS outreach_copies_campaign_id_idx ON outreach_copies(campaign_id);
CREATE INDEX IF NOT EXISTS llm_usage_events_org_id_idx ON llm_usage_events(org_id);

-- Enable RLS on all tables
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_model_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_provider_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_usage_events ENABLE ROW LEVEL SECURITY;
-- model_providers and available_models are platform-global (read-only for users)
ALTER TABLE model_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE available_models ENABLE ROW LEVEL SECURITY;
