-- Switch default text model from qwen/qwen3.6-flash to deepseek/deepseek-v4-flash.
-- Qwen row stays active and compatible — just no longer the default.

INSERT INTO available_models (
  provider_key, model_id, model_label, model_type, cost_tier, key_source,
  is_active, is_recommended, recommendation_order, recommendation_text,
  default_for_step_key, compatible_step_keys,
  cost_per_1k_input_tokens, cost_per_1k_output_tokens, notes
)
VALUES (
  'openrouter', 'deepseek/deepseek-v4-flash', 'DeepSeek V4 Flash', 'text', 'cheap', 'platform',
  true, true, 1, 'Default text model for all utility text generation.',
  ARRAY['prompt_assembly','relevance_scoring','outreach_copy','campaign_brief','social_caption'],
  ARRAY['prompt_assembly','outreach_copy','campaign_brief','relevance_scoring','social_caption'],
  0.00005, 0.00010,
  'Default text model on OpenRouter as of 2026-05-04.'
)
ON CONFLICT DO NOTHING;

UPDATE available_models
SET default_for_step_key = (
  SELECT COALESCE(array_agg(s), ARRAY[]::text[])
  FROM unnest(default_for_step_key) AS s
  WHERE s NOT IN ('prompt_assembly','relevance_scoring','outreach_copy','campaign_brief','social_caption')
)
WHERE model_id != 'deepseek/deepseek-v4-flash'
  AND default_for_step_key && ARRAY['prompt_assembly','relevance_scoring','outreach_copy','campaign_brief','social_caption'];
