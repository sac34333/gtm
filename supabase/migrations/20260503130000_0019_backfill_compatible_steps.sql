-- Backfill compatible_step_keys so /settings/models lists models per step.
-- The StepCard dropdown filters by compatible_step_keys.includes(step_key); a
-- NULL value silently shows "No compatible models". This also wires up the
-- new 'social_caption' step.
--
-- Pattern:
--   text  -> [prompt_assembly, outreach_copy, campaign_brief, relevance_scoring, social_caption]
--   image -> [image_generation]
--   video -> [video_generation]
--   embed -> [brand_embedding]

UPDATE available_models
SET compatible_step_keys = ARRAY[
  'prompt_assembly', 'outreach_copy', 'campaign_brief',
  'relevance_scoring', 'social_caption'
]
WHERE model_type = 'text' AND is_active = true;

UPDATE available_models
SET compatible_step_keys = ARRAY['image_generation']
WHERE model_type = 'image' AND is_active = true
  AND (compatible_step_keys IS NULL OR NOT 'image_generation' = ANY(compatible_step_keys));

UPDATE available_models
SET compatible_step_keys = ARRAY['video_generation']
WHERE model_type = 'video' AND is_active = true
  AND (compatible_step_keys IS NULL OR NOT 'video_generation' = ANY(compatible_step_keys));

UPDATE available_models
SET compatible_step_keys = ARRAY['brand_embedding']
WHERE model_type = 'embedding' AND is_active = true
  AND (compatible_step_keys IS NULL OR NOT 'brand_embedding' = ANY(compatible_step_keys));
