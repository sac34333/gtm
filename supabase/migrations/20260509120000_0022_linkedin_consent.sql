-- Add consent tracking columns to org_linkedin_connections
-- Client must accept terms before saving a LinkedIn token.
ALTER TABLE public.org_linkedin_connections
  ADD COLUMN IF NOT EXISTS consent_given_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_given_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.org_linkedin_connections.consent_given_at IS 'Timestamp when the connecting user accepted the LinkedIn integration terms';
COMMENT ON COLUMN public.org_linkedin_connections.consent_given_by IS 'auth.users.id of the user who accepted the terms';
