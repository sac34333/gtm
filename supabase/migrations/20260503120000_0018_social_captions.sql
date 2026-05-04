-- Captions feature: per-platform social copy auto-generated for each asset.
-- Stored on the same generation_jobs row, generated immediately after the
-- visual is ready (synchronously for image, in poll-job-status for video).
--
-- captions jsonb shape:
-- {
--   "_status": "pending" | "ready" | "failed",
--   "_error": "...",
--   "_generated_at": "2026-05-03T...",
--   "linkedin": { "text": "...", "hashtags": ["#a"], "char_count": 1234, "model_id": "..." },
--   "x":        { ... },
--   "instagram":{ ... },
--   "whatsapp": { ... }
-- }

ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS captions jsonb;

-- Caption prompt templates — modular like image prompts (migration 0015).
-- Editable per-org by overriding the org_id IS NULL global rows.
INSERT INTO prompt_templates (org_id, step_key, section_key, position, template_text, is_active, description)
VALUES
  (NULL, 'social_caption', 'linkedin', 10,
   E'Write a LinkedIn post for {{brand_name}}.\n\nSubject: {{subject}}\nWhy this matters now: {{signal_headline}}\nThe visual we''re posting: {{visual_description}}\nCall to action: {{cta}}\n\nBrand voice:\n- Pitch: {{brand_pitch}}\n- Tone: {{tone_summary}}\n- Emoji usage: {{emoji_usage}}\n- CTA style: {{cta_style}}\n{{voice_example}}\n\nLinkedIn rules:\n- 800-1500 chars, narrative arc with a hook in the first line that creates curiosity\n- Single short lines, lots of whitespace, no walls of text\n- Use • bullets if listing 3+ items\n- 3-5 hashtags at the very end (B2B-relevant, no #love or fluff)\n- No markdown, no asterisks, no headers\n- End with the CTA in the last line\n{{phrases_to_avoid}}\n\nReturn ONLY a JSON object: { "text": "...", "hashtags": ["#a","#b"] }. No preamble.',
   true, 'LinkedIn post — narrative, professional, 800-1500 chars'),
  (NULL, 'social_caption', 'x', 20,
   E'Write a single X (Twitter) post for {{brand_name}}.\n\nSubject: {{subject}}\nWhy now: {{signal_headline}}\nVisual: {{visual_description}}\nCTA: {{cta}}\n\nBrand voice:\n- Pitch: {{brand_pitch}}\n- Tone: {{tone_summary}}\n- Emoji usage: {{emoji_usage}}\n- CTA style: {{cta_style}}\n{{voice_example}}\n\nX rules:\n- HARD MAX 270 characters including hashtags. Count strictly.\n- One sharp hook. No throat-clearing.\n- Punchy, contrarian or insightful. Punctuation matters.\n- 0-2 inline hashtags max. Often zero is better.\n- No "thread" indicator. Single post only.\n{{phrases_to_avoid}}\n\nReturn ONLY a JSON object: { "text": "...", "hashtags": ["#a"] }. No preamble.',
   true, 'X / Twitter post — punchy, ≤270 chars'),
  (NULL, 'social_caption', 'instagram', 30,
   E'Write an Instagram caption for {{brand_name}}.\n\nSubject: {{subject}}\nVisual context: {{visual_description}}\nCTA: {{cta}}\n\nBrand voice:\n- Pitch: {{brand_pitch}}\n- Tone: {{tone_summary}}\n- Emoji usage: {{emoji_usage}}\n- CTA style: {{cta_style}}\n{{voice_example}}\n\nInstagram rules:\n- First line is the hook (only ~125 chars show before "more")\n- Short paragraphs separated by line breaks (use emoji as separators if brand voice allows)\n- Max 2200 chars total but aim for 300-800\n- 8-15 niche hashtags, grouped at the end\n- Conversational, aspirational, personal\n- "Link in bio" style CTA if external link needed\n{{phrases_to_avoid}}\n\nReturn ONLY a JSON object: { "text": "...", "hashtags": ["#a","#b"] }. No preamble.',
   true, 'Instagram caption — hook-first, hashtag-rich'),
  (NULL, 'social_caption', 'whatsapp', 40,
   E'Write a WhatsApp broadcast / status message for {{brand_name}}.\n\nSubject: {{subject}}\nWhy now: {{signal_headline}}\nVisual: {{visual_description}}\nCTA: {{cta}}\n\nBrand voice:\n- Pitch: {{brand_pitch}}\n- Tone: {{tone_summary}}\n- CTA style: {{cta_style}}\n{{voice_example}}\n\nWhatsApp rules:\n- VERY short. 1-3 lines, 200 chars max.\n- Conversational, direct. Like texting a friend who happens to be a customer.\n- One clear ask. No hashtags.\n- Use *bold* sparingly via asterisks (WhatsApp formatting).\n- If urgent / timely, lead with that.\n{{phrases_to_avoid}}\n\nReturn ONLY a JSON object: { "text": "...", "hashtags": [] }. No preamble.',
   true, 'WhatsApp broadcast — terse, conversational'),
  (NULL, 'social_caption', 'twitter', 50,
   E'(Alias of "x" — kept for backward compat with prompt_tags.platform=twitter.) Write a single X (Twitter) post for {{brand_name}}.\n\nSubject: {{subject}}\nVisual: {{visual_description}}\nCTA: {{cta}}\n\nBrand voice: {{tone_summary}}, emoji {{emoji_usage}}.\n{{voice_example}}\n\nRules: ≤270 chars, one sharp hook, 0-2 hashtags.\n{{phrases_to_avoid}}\n\nReturn ONLY: { "text": "...", "hashtags": [] }. No preamble.',
   true, 'Alias for X');

-- Make existing text-model defaults eligible for social_caption step.
UPDATE available_models
SET default_for_step_key = array_append(default_for_step_key, 'social_caption')
WHERE 'outreach_copy' = ANY(default_for_step_key)
  AND NOT 'social_caption' = ANY(COALESCE(default_for_step_key, ARRAY[]::text[]));

UPDATE available_models
SET compatible_step_keys = array_append(compatible_step_keys, 'social_caption')
WHERE 'outreach_copy' = ANY(COALESCE(compatible_step_keys, ARRAY[]::text[]))
  AND NOT 'social_caption' = ANY(COALESCE(compatible_step_keys, ARRAY[]::text[]));
