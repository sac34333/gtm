-- Migration 0029: Add unique constraint to org_api_keys(org_id, key_name)
-- Without this, the upsert with onConflict:'org_id,key_name' in save-data-source-key
-- throws a Postgres error, which is caught and returned as internal_error (500).
ALTER TABLE public.org_api_keys
  ADD CONSTRAINT org_api_keys_org_id_key_name_key UNIQUE (org_id, key_name);
