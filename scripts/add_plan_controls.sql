-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: plan controls, commitment tracking, booking-plan link
-- Run once in Supabase SQL editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Settings: monthly plan enabled toggle
INSERT INTO settings (key, value)
VALUES ('monthly_plan_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- 2. subscription_plans: min commitment months (default 3)
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS min_commitment_months integer NOT NULL DEFAULT 3;

-- 3. subscriptions: commitment end date + cycle pickup counter
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS commitment_ends_at   date,
  ADD COLUMN IF NOT EXISTS pickups_this_cycle   integer NOT NULL DEFAULT 0;

-- 4. bookings: link to monthly plan subscription
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS plan_subscription_id uuid REFERENCES subscriptions(id);

CREATE INDEX IF NOT EXISTS bookings_plan_subscription_id_idx
  ON bookings(plan_subscription_id)
  WHERE plan_subscription_id IS NOT NULL;
