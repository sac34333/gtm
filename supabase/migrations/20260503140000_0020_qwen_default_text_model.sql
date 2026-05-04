-- Set Qwen 3.6 Flash via OpenRouter as default for ALL utility text steps.
-- Image and video generation defaults are NOT touched.
--
-- Affected steps: prompt_assembly, relevance_scoring, outreach_copy,
--                 campaign_brief, social_caption.

INSERT INTO available_models (
  provider_key, model_id, model_label, model_type, cost_tier, key_source,
  is_active, is_recommended, recommendation_order, recommendation_text,
  default_for_step_key, compatible_step_keys,
  cost_per_1k_input_tokens, cost_per_1k_output_tokens, notes
)
VALUES (
  'openrouter', 'qwen/qwen3.6-flash', 'Qwen 3.6 Flash', 'text', 'cheap', 'platform',
  true, true, 1, 'Cheapest text model — default for all utility text generation.',
  ARRAY['prompt_assembly','relevance_scoring','outreach_copy','campaign_brief','social_caption'],
  ARRAY['prompt_assembly','outreach_copy','campaign_brief','relevance_scoring','social_caption'],
  0.00005, 0.00010,
  'Cheapest available text model on OpenRouter. Verify slug resolves at runtime.'
)
ON CONFLICT DO NOTHING;

-- Strip those step_keys from any other model that previously held them as default.
UPDATE available_models
SET default_for_step_key = (
  SELECT COALESCE(array_agg(s), ARRAY[]::text[])
  FROM unnest(default_for_step_key) AS s
  WHERE s NOT IN ('prompt_assembly','relevance_scoring','outreach_copy','campaign_brief','social_caption')
)
WHERE model_id != 'qwen/qwen3.6-flash'
  AND default_for_step_key && ARRAY['prompt_assembly','relevance_scoring','outreach_copy','campaign_brief','social_caption'];
