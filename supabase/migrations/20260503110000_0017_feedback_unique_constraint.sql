-- One feedback row per (job, user). Lets users change their vote via upsert,
-- but prevents accumulating duplicate rows when state resets (page reload, etc).
ALTER TABLE generation_feedback
  ADD CONSTRAINT generation_feedback_unique_user_job UNIQUE (job_id, user_id);
