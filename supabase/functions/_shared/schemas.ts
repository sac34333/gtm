import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts'

// ─── Prompt Tags ─────────────────────────────────────────────────────────────

export const PromptTagsSchema = z.object({
  subject: z.string().min(1).max(200),
  visual_style: z.enum(['photography', 'illustration', 'abstract', '3d', 'flat']).optional(),
  mood: z.enum(['professional', 'bold', 'calm', 'energetic', 'minimal', 'warm']).optional(),
  colour_palette: z.string().max(200).optional(),
  platform: z.enum(['linkedin', 'instagram', 'twitter', 'whatsapp', 'generic']).optional(),
  aspect_ratio: z.enum(['1:1', '16:9', '9:16', '4:5']).optional(),
  cta_text: z.string().max(80).optional(),
  negative_prompt: z.string().max(500).optional(),
  additional_notes: z.string().max(500).optional(),
})
export type PromptTags = z.infer<typeof PromptTagsSchema>

// ─── ContentJob ──────────────────────────────────────────────────────────────

export const ContentJobSchema = z.object({
  job_id: z.string().uuid(),
  org_id: z.string().uuid(),
  org_slug: z.string(),
  asset_type: z.enum(['image', 'video']),
  provider_key: z.string(),
  model_id: z.string(),
  prompt_tags: PromptTagsSchema,
  brand_context_summary: z.string(),
  voice_examples: z.array(z.string()).max(3),
  competitor_names: z.array(z.string()),
  signal_headline: z.string().optional(),
  signal_summary: z.string().optional(),
  compiled_prompt: z.string(),
  compiled_negative: z.string(),
})
export type ContentJob = z.infer<typeof ContentJobSchema>

// JSON Schema for structured output (OpenRouter/OpenAI/Anthropic)
export const ContentJobJsonSchema = {
  type: 'object',
  required: ['job_id', 'org_id', 'org_slug', 'asset_type', 'provider_key', 'model_id',
    'prompt_tags', 'brand_context_summary', 'voice_examples', 'competitor_names',
    'compiled_prompt', 'compiled_negative'],
  properties: {
    job_id: { type: 'string' },
    org_id: { type: 'string' },
    org_slug: { type: 'string' },
    asset_type: { type: 'string', enum: ['image', 'video'] },
    provider_key: { type: 'string' },
    model_id: { type: 'string' },
    prompt_tags: {
      type: 'object',
      required: ['subject'],
      properties: {
        subject: { type: 'string' },
        visual_style: { type: 'string' },
        mood: { type: 'string' },
        colour_palette: { type: 'string' },
        platform: { type: 'string' },
        aspect_ratio: { type: 'string' },
        cta_text: { type: 'string' },
        negative_prompt: { type: 'string' },
        additional_notes: { type: 'string' },
      },
    },
    brand_context_summary: { type: 'string' },
    voice_examples: { type: 'array', items: { type: 'string' } },
    competitor_names: { type: 'array', items: { type: 'string' } },
    signal_headline: { type: 'string' },
    signal_summary: { type: 'string' },
    compiled_prompt: { type: 'string' },
    compiled_negative: { type: 'string' },
  },
  additionalProperties: false,
}

// ─── Edge Function Request Schemas ───────────────────────────────────────────

export const CreateOrgBodySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(3).max(30).regex(/^[a-z0-9-]+$/, 'Slug must be URL-safe (a-z, 0-9, hyphens)'),
})

export const SaveOnboardingBodySchema = z.object({
  // Section 1
  company_name: z.string().max(200).optional(),
  country_code: z.string().max(10).optional(),
  industry_sector: z.string().max(100).optional(),
  company_size: z.string().optional(),
  website_url: z.string().url().optional().or(z.literal('')),
  founding_year: z.number().int().min(1800).max(2100).optional(),
  one_sentence_pitch: z.string().max(200).optional(),
  extended_description: z.string().max(2000).optional(),
  products_services: z.array(z.object({
    name: z.string().max(100),
    description: z.string().max(500),
  })).max(5).optional(),
  revenue_model: z.string().optional(),
  geographies_served: z.array(z.string()).optional(),
  industries_targeted: z.array(z.string()).optional(),
  company_sizes_targeted: z.array(z.string()).optional(),
  decision_maker_titles: z.array(z.string()).max(5).optional(),
  // Section 2
  tone_formal_conversational: z.number().int().min(0).max(100).optional(),
  tone_safe_bold: z.number().int().min(0).max(100).optional(),
  tone_corporate_human: z.number().int().min(0).max(100).optional(),
  tone_data_story: z.number().int().min(0).max(100).optional(),
  tone_conservative_provocative: z.number().int().min(0).max(100).optional(),
  sentence_length: z.enum(['short', 'medium', 'long']).optional(),
  jargon_level: z.enum(['avoid', 'moderate', 'heavy']).optional(),
  emoji_usage: z.enum(['never', 'sparingly', 'freely']).optional(),
  cta_style: z.enum(['soft', 'direct', 'urgent']).optional(),
  voice_examples: z.array(z.string().max(2000)).max(3).optional(),
  // Section 3
  brand_colours: z.object({
    primary: z.string().max(20),
    secondary: z.string().max(20),
    accent: z.string().max(20),
  }).optional(),
  logo_url: z.string().optional(),
  guidelines_pdf_url: z.string().optional(),
  reference_image_urls: z.array(z.string()).max(5).optional(),
  anti_reference_image_urls: z.array(z.string()).max(3).optional(),
  visual_style: z.enum(['photography', 'illustration', 'abstract']).optional(),
  dark_light_preference: z.enum(['dark', 'light', 'neutral']).optional(),
  composition: z.enum(['busy', 'balanced', 'minimal']).optional(),
  human_faces: z.enum(['yes', 'no', 'diverse_only']).optional(),
  location_style: z.enum(['real_locations', 'studio', 'abstract']).optional(),
  // Section 4
  active_themes: z.array(z.string().max(200)).max(3).optional(),
  competitor_names: z.array(z.string().max(200)).max(10).optional(),
  primary_platform: z.enum(['linkedin', 'twitter_x', 'instagram', 'whatsapp_business', 'email']).optional(),
  secondary_platform: z.enum(['linkedin', 'twitter_x', 'instagram', 'whatsapp_business', 'email']).optional(),
  target_posts_per_week: z.number().int().min(0).max(100).optional(),
  timezone: z.string().max(100).optional(),
  topics_to_avoid: z.array(z.string()).optional(),
  phrases_to_avoid: z.array(z.string()).optional(),
  visual_styles_to_avoid: z.string().max(500).optional(),
  cultural_sensitivities: z.string().max(500).optional(),
  // Completion flag
  complete: z.boolean().optional(),
})

export const GenerateAssetBodySchema = z.object({
  content_job: ContentJobSchema,
  model_id: z.string().optional(),
  provider_key: z.string().optional(),
})

export const GetUploadUrlBodySchema = z.object({
  bucket: z.literal('brands'),
  path: z.string().min(1).max(500),
  content_type: z.enum(['image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf', 'image/webp']),
})

export const SubmitFeedbackBodySchema = z.object({
  job_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5).optional(),
  thumbs: z.enum(['up', 'down']).optional(),
  note: z.string().max(1000).optional(),
  tags_changed: z.record(z.unknown()).optional(),
  regenerated: z.boolean().optional(),
}).refine(data => data.rating !== undefined || data.thumbs !== undefined, {
  message: 'At least one of rating or thumbs must be provided',
})

export const SaveModelPreferencesBodySchema = z.object({
  preferences: z.array(z.object({
    step_key: z.string().min(1),
    provider_key: z.string().min(1),
    model_id: z.string().min(1),
    model_label: z.string().min(1),
  })).min(1).max(20),
})

export const SaveProviderKeyBodySchema = z.object({
  provider_key: z.string().min(1).max(50),
  api_key: z.string().min(1).max(500),
  key_label: z.string().max(100).optional(),
})

export const UpdateOrgSettingsBodySchema = z.object({
  signal_ingestion_enabled: z.boolean().optional(),
  signal_ingestion_frequency: z.enum(['daily', 'every_2_days', 'every_3_days', 'every_5_days', 'monthly']).optional(),
})

export const SaveDataSourceKeyBodySchema = z.object({
  key_name: z.string().min(1).max(100),
  value: z.string().min(1).max(500),
})

export const InviteUserBodySchema = z.object({
  email: z.string().email().max(254),
  role: z.enum(['admin', 'member']).default('member'),
})

export const DeleteProviderKeyBodySchema = z.object({
  provider_key: z.string().min(1).max(50),
})

export const RemoveMemberBodySchema = z.object({
  user_id: z.string().uuid(),
  action: z.enum(['remove', 'change_role']),
  new_role: z.enum(['admin', 'member']).optional(),
})

export const CreateCampaignBodySchema = z.object({
  name: z.string().min(1).max(120),
  campaign_type: z.enum(['awareness', 'lead_gen', 'nurture', 'product_launch']),
  description: z.string().max(500).optional(),
  channel_mix: z.array(z.enum(['linkedin_message', 'linkedin_post', 'email', 'cold_dm', 'twitter'])).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  job_id: z.string().uuid().optional(),
  duration_days: z.number().int().min(1).max(90).optional(),
  working_days_only: z.boolean().optional(),
})

export const AddCampaignProspectsBodySchema = z.object({
  campaign_id: z.string().uuid(),
  prospect_ids: z.array(z.string().uuid()).min(1).max(1000),
})

export const UpdateCampaignBodySchema = z.object({
  campaign_id: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  status: z.enum(['draft', 'active', 'completed', 'paused']).optional(),
  campaign_type: z.enum(['awareness', 'lead_gen', 'nurture', 'product_launch']).optional(),
  description: z.string().max(500).optional(),
  channel_mix: z.array(z.enum(['linkedin_message', 'linkedin_post', 'email', 'cold_dm', 'twitter'])).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  job_id: z.string().uuid().optional().nullable(),
  duration_days: z.number().int().min(1).max(90).optional(),
  working_days_only: z.boolean().optional(),
})

export const GenerateCampaignBriefBodySchema = z.object({
  campaign_id: z.string().uuid(),
  job_id: z.string().uuid().optional(),
  prospect_ids: z.array(z.string().uuid()).optional(),
  channel_mix: z.array(z.enum(['linkedin_message', 'linkedin_post', 'email', 'cold_dm', 'twitter'])).optional(),
  // When true, skip brief generation + PDF and only (re)generate per-prospect outreach copies.
  // Used to backfill copies on a campaign whose brief already exists.
  copies_only: z.boolean().optional(),
})
