-- ── subscription_plans ────────────────────────────────────────────────────────
-- Admin-configurable monthly plan tiers (e.g. 50 lbs/$139, 100 lbs/$249)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id          uuid REFERENCES locations(id) ON DELETE CASCADE,
  name                 text NOT NULL,
  monthly_price_cents  integer NOT NULL,          -- flat monthly fee
  lbs_included         integer NOT NULL,          -- lbs in the monthly bucket
  overage_rate_cents   integer NOT NULL,          -- per lb above bucket
  stripe_product_id    text,                      -- Stripe Product ID
  stripe_price_id      text,                      -- Stripe recurring Price ID
  is_popular           boolean NOT NULL DEFAULT false,
  is_active            boolean NOT NULL DEFAULT true,
  sort_order           integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- ── extend subscriptions ──────────────────────────────────────────────────────
-- Add monthly-plan fields alongside the existing per-pickup fields.
-- subscription_type distinguishes the two models.
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS subscription_type      text NOT NULL DEFAULT 'per_pickup',
  ADD COLUMN IF NOT EXISTS plan_id                uuid REFERENCES subscription_plans(id),
  ADD COLUMN IF NOT EXISTS monthly_price_cents     integer,
  ADD COLUMN IF NOT EXISTS lbs_included            integer,
  ADD COLUMN IF NOT EXISTS overage_rate_cents      integer,
  ADD COLUMN IF NOT EXISTS lbs_used_this_cycle     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cycle_start             date,
  ADD COLUMN IF NOT EXISTS cycle_end               date,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  text;

-- Index for fast customer lookups by Stripe subscription ID
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub_id
  ON subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
