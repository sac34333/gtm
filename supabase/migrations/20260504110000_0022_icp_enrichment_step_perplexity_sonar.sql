-- Add a dedicated model-settings step for ICP & Prospects (LLM web-search prospect discovery).
-- Default model: perplexity/sonar via OpenRouter (real-time web grounded).

INSERT INTO available_models (
  provider_key, model_id, model_label, model_type, cost_tier, key_source,
  default_for_step_key, compatible_step_keys, output_modalities,
  is_active, is_recommended, recommendation_order, recommendation_text,
  context_length, max_output_tokens, requires_paid_plan,
  estimated_time_seconds, release_date,
  cost_per_1k_input_tokens, cost_per_1k_output_tokens, notes
) VALUES (
  'openrouter', 'perplexity/sonar', 'Perplexity Sonar', 'text', 'cheap', 'user_or_platform',
  ARRAY['icp_enrichment'], ARRAY['icp_enrichment'], ARRAY['text'],
  true, true, 1, 'Real-time web search built in. Best for prospect discovery and live research.',
  128000, 4000, false,
  20, '2025-01-21',
  0.001, 0.001,
  'Online by default — grounds answers in live web (LinkedIn, Crunchbase, news). Used for ICP & Prospects discovery.'
);

-- Mark deepseek-v4-flash as compatible with icp_enrichment so users can switch to it
-- (cheaper, but uses :online suffix via Exa rather than native search).
UPDATE available_models
SET compatible_step_keys = ARRAY(
  SELECT DISTINCT unnest(coalesce(compatible_step_keys, ARRAY[]::text[]) || ARRAY['icp_enrichment'])
)
WHERE provider_key = 'openrouter' AND model_id = 'deepseek/deepseek-v4-flash';
