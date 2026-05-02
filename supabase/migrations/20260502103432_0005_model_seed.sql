-- Migration 0005: Model and provider seed data
-- Applied: 2026-05-02T10:34:32Z (version 20260502103432)

-- ─── MODEL PROVIDERS ─────────────────────────────────────────────────────────
INSERT INTO model_providers (provider_key, display_name, api_base_url, models_endpoint, platform_key_available, is_active, docs_url) VALUES
  ('openai',      'OpenAI',          'https://api.openai.com/v1',          '/models',   true,  true, 'https://platform.openai.com/docs'),
  ('anthropic',   'Anthropic',       'https://api.anthropic.com/v1',       NULL,        true,  true, 'https://docs.anthropic.com'),
  ('openrouter',  'OpenRouter',      'https://openrouter.ai/api/v1',       '/models',   true,  true, 'https://openrouter.ai/docs'),
  ('fal',         'fal.ai',          'https://fal.run',                    NULL,        true,  true, 'https://fal.ai/docs'),
  ('google',      'Google Gemini',   'https://generativelanguage.googleapis.com/v1beta', NULL, true, true, 'https://ai.google.dev/docs'),
  ('replicate',   'Replicate',       'https://api.replicate.com/v1',       NULL,        false, true, 'https://replicate.com/docs')
ON CONFLICT (provider_key) DO NOTHING;

-- ─── AVAILABLE MODELS ────────────────────────────────────────────────────────
INSERT INTO available_models (provider_key, model_id, model_label, model_type, cost_tier, key_source, default_for_step_key, is_active, is_recommended, recommendation_order, context_length, max_output_tokens) VALUES

-- OpenAI text models
('openai', 'gpt-4o',        'GPT-4o',         'text',  'standard', 'platform', ARRAY['build_prompt','personalise','generate_campaign_brief','outreach_copy'], true, true, 1, 128000, 4096),
('openai', 'gpt-4o-mini',   'GPT-4o Mini',    'text',  'low',      'platform', ARRAY['campaign_brief'], true, false, 3, 128000, 4096),
('openai', 'o1-mini',       'o1-mini',        'text',  'high',     'platform', NULL, true, false, NULL, 128000, 65536),

-- Anthropic text models
('anthropic', 'claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', 'text', 'standard', 'platform', NULL, true, true, 2, 200000, 8192),
('anthropic', 'claude-3-haiku-20240307',    'Claude 3 Haiku',    'text', 'low',      'platform', NULL, true, false, 4, 200000, 4096),

-- OpenRouter routing (text)
('openrouter', 'openai/gpt-4o',               'GPT-4o (via OpenRouter)',        'text',  'standard', 'platform', NULL, true, false, NULL, 128000, 4096),
('openrouter', 'anthropic/claude-3.5-sonnet', 'Claude 3.5 Sonnet (via OpenRouter)', 'text', 'standard', 'platform', NULL, true, false, NULL, 200000, 8192),

-- fal.ai image models
('fal', 'fal-ai/flux/schnell',  'FLUX Schnell',  'image', 'low',      'platform', ARRAY['image_gen'], true, true,  1, NULL, NULL),
('fal', 'fal-ai/flux/dev',      'FLUX Dev',      'image', 'standard', 'platform', NULL, true, false, 2, NULL, NULL),
('fal', 'fal-ai/flux-pro',      'FLUX Pro',      'image', 'high',     'platform', NULL, true, false, 3, NULL, NULL),
('fal', 'fal-ai/recraft-v3',    'Recraft V3',    'image', 'standard', 'platform', NULL, true, false, 4, NULL, NULL),
('fal', 'fal-ai/ideogram/v2',   'Ideogram V2',   'image', 'standard', 'platform', NULL, true, false, 5, NULL, NULL),

-- fal.ai video models
('fal', 'fal-ai/kling-video/v1.6/standard/text-to-video', 'Kling 1.6 Standard (T2V)', 'video', 'high',     'platform', ARRAY['video_gen'], true, true,  1, NULL, NULL),
('fal', 'fal-ai/kling-video/v1.6/pro/text-to-video',      'Kling 1.6 Pro (T2V)',      'video', 'premium',  'platform', NULL, true, false, 2, NULL, NULL),
('fal', 'fal-ai/hunyuan-video',                           'HunyuanVideo',             'video', 'high',     'platform', NULL, true, false, 3, NULL, NULL),
('fal', 'fal-ai/luma-dream-machine',                       'Luma Dream Machine',       'video', 'high',     'platform', NULL, true, false, 4, NULL, NULL),

-- OpenRouter image models
('openrouter', 'openai/dall-e-3',            'DALL-E 3 (via OpenRouter)',       'image', 'standard', 'platform', NULL, true, false, NULL, NULL, NULL),
('openrouter', 'google/gemini-pro-vision',   'Gemini Pro Vision (via OpenRouter)', 'image', 'standard', 'platform', NULL, true, false, NULL, NULL, NULL)

ON CONFLICT (provider_key, model_id) DO NOTHING;
