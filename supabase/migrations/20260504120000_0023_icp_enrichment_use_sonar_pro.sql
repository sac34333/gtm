-- Switch ICP & Prospects default to perplexity/sonar-pro.
-- Reason: plain `sonar` is too conservative for *enumeration* tasks — it tends to
-- return [] rather than commit to verified named matches. `sonar-pro` is much
-- better at returning real lists of people/companies from live web search.

-- 1. Insert sonar-pro as a recommended model for icp_enrichment.
INSERT INTO available_models (
  provider_key, model_id, model_label, model_type, cost_tier, key_source,
  default_for_step_key, compatible_step_keys, output_modalities,
  is_active, is_recommended, recommendation_order, recommendation_text,
  context_length, max_output_tokens, requires_paid_plan,
  estimated_time_seconds, release_date,
  cost_per_1k_input_tokens, cost_per_1k_output_tokens, notes
) VALUES (
  'openrouter', 'perplexity/sonar-pro', 'Perplexity Sonar Pro', 'text', 'mid', 'user_or_platform',
  ARRAY['icp_enrichment'], ARRAY['icp_enrichment'], ARRAY['text'],
  true, true, 1, 'Best for prospect discovery — live web search with stronger entity enumeration.',
  200000, 8000, false,
  25, '2025-01-21',
  0.003, 0.015,
  'Premium Perplexity model. Used for ICP & Prospects discovery. Better than plain Sonar at returning verified named entities.'
)
ON CONFLICT (provider_key, model_id) DO UPDATE SET
  default_for_step_key = ARRAY['icp_enrichment'],
  compatible_step_keys = ARRAY(
    SELECT DISTINCT unnest(coalesce(available_models.compatible_step_keys, ARRAY[]::text[]) || ARRAY['icp_enrichment'])
  ),
  is_active = true,
  is_recommended = true,
  recommendation_order = 1;

-- 2. Demote plain sonar — keep it as a compatible (cheaper) option but not default.
UPDATE available_models
SET default_for_step_key = ARRAY(
      SELECT unnest(coalesce(default_for_step_key, ARRAY[]::text[]))
      EXCEPT SELECT 'icp_enrichment'
    ),
    recommendation_order = 2,
    recommendation_text = 'Cheaper Perplexity model — may return fewer prospects but lower cost per run.'
WHERE provider_key = 'openrouter' AND model_id = 'perplexity/sonar';
