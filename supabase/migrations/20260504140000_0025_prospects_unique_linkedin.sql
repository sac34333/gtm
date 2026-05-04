-- Required for icp-enrich's upsert(onConflict: 'org_id,linkedin_url').
-- Without this, every web_search prospect insert silently failed and 0 prospects
-- were saved. NULL linkedin_urls are allowed (Postgres treats NULLs as distinct).
ALTER TABLE prospects
  ADD CONSTRAINT prospects_org_linkedin_uniq UNIQUE (org_id, linkedin_url);
