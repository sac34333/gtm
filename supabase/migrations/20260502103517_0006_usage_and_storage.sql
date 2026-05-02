-- Migration 0006: Usage tracking and Storage bucket configuration
-- Applied: 2026-05-02T10:35:17Z (version 20260502103517)

-- Storage buckets are created via Supabase dashboard / MCP, not SQL.
-- This migration documents the bucket configuration for reproducibility.

-- Buckets created:
--   assets   (private, 50MB limit) - generated images and videos
--   briefs   (private, 20MB limit) - campaign brief PDFs
--   uploads  (private, 10MB limit) - user brand guideline uploads

-- Usage tracking trigger: auto-increment image_used/video_used on job completion
CREATE OR REPLACE FUNCTION increment_org_quota()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    IF NEW.asset_type IN ('image', 'carousel') THEN
      UPDATE orgs SET image_used = image_used + 1, updated_at = now()
        WHERE id = NEW.org_id;
    ELSIF NEW.asset_type = 'video' THEN
      UPDATE orgs SET video_used = video_used + 1, updated_at = now()
        WHERE id = NEW.org_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER generation_jobs_quota_trigger
  AFTER UPDATE ON generation_jobs
  FOR EACH ROW EXECUTE FUNCTION increment_org_quota();

-- Updated_at triggers for key tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON orgs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON brand_contexts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON feed_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON signals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON generation_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON prospects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON campaign_briefs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON outreach_copies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON org_model_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON org_provider_api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON available_models
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
