-- Migration 0005b: Fix default_for_step_key column type (was text, changed to text[])
-- Applied: 2026-05-02T10:35:04Z (version 20260502103504)

-- Update default_for_step_key entries to use consistent array values
-- This migration documents the column type correction and re-seeds key defaults

UPDATE available_models
  SET default_for_step_key = ARRAY['build_prompt','personalise','outreach_copy','campaign_brief']
WHERE provider_key = 'openai' AND model_id = 'gpt-4o';

UPDATE available_models
  SET default_for_step_key = ARRAY['image_gen']
WHERE provider_key = 'fal' AND model_id = 'fal-ai/flux/schnell';

UPDATE available_models
  SET default_for_step_key = ARRAY['video_gen']
WHERE provider_key = 'fal' AND model_id = 'fal-ai/kling-video/v1.6/standard/text-to-video';
