-- 0028_subscription_plans.sql
-- Data-driven plan catalog. Webhook + checkout look up plan limits by Dodo product_id.
-- Adding/changing a plan = INSERT/UPDATE here. No code deploy required.

CREATE TABLE IF NOT EXISTS subscription_plans (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dodo_product_id     text UNIQUE NOT NULL,
  tier_key            text NOT NULL,           -- 'starter' | 'growth' | 'scale' | 'client_1m' | ...
  display_name        text NOT NULL,
  seat_limit          integer NOT NULL,
  image_quota         integer NOT NULL,
  video_quota         integer NOT NULL,
  icp_quota           integer NOT NULL DEFAULT 0,    -- monthly ICP enrichment runs
  brief_quota         integer NOT NULL DEFAULT 0,    -- monthly campaign briefs
  commitment_months   integer NOT NULL DEFAULT 1,    -- minimum term before self-cancel
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_plans_active_idx ON subscription_plans (is_active) WHERE is_active = true;

-- RLS: read-only for authenticated users (anyone in any org can read the public plan catalog)
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_plans_read ON subscription_plans;
CREATE POLICY subscription_plans_read ON subscription_plans
  FOR SELECT TO authenticated
  USING (is_active = true);

-- Service role bypasses RLS for webhook + checkout writes.

-- ── Track commitment end so users can't self-cancel before term ends ──
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS commitment_ends_at timestamptz;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS dodo_product_id    text;

-- ── Seed the 3 LIVE plans (May 2026) ──
INSERT INTO subscription_plans
  (dodo_product_id, tier_key, display_name, seat_limit, image_quota, video_quota, icp_quota, brief_quota, commitment_months)
VALUES
  ('pdt_0NeBn8TYZ7oW7cDbBM2NI', 'client_1m', 'Starter — 1 month', 3, 25, 5, 100, 20, 1),
  ('pdt_0NeBn8ZuuhgCLYvSlC60X', 'client_3m', 'Growth — 3 months',  5, 30, 5, 150, 50, 3),
  ('pdt_0NeBn8d6qGzctz4XomQvq', 'client_6m', 'Pro — 6 months',     8, 45, 8, 200, 100, 6)
ON CONFLICT (dodo_product_id) DO UPDATE SET
  tier_key          = EXCLUDED.tier_key,
  display_name      = EXCLUDED.display_name,
  seat_limit        = EXCLUDED.seat_limit,
  image_quota       = EXCLUDED.image_quota,
  video_quota       = EXCLUDED.video_quota,
  icp_quota         = EXCLUDED.icp_quota,
  brief_quota       = EXCLUDED.brief_quota,
  commitment_months = EXCLUDED.commitment_months,
  updated_at        = now();
