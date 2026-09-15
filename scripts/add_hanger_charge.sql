-- Hangers: counted at folding/finishing time (unknown until the order is
-- processed), billed as a separate off-session charge against the customer's
-- saved card — NOT part of calculateOrderBilling / the weight-based charge,
-- since hangers are usually only known after that charge has already
-- captured. See lib/hanger-billing.ts and app/actions/hangers.ts.
--
-- Deliberately does NOT touch facility_cost_cents or add a facility rate —
-- hangers are pure customer charge for now (2026-09-15 decision).

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS hanger_count integer,
  ADD COLUMN IF NOT EXISTS hanger_price_cents_applied integer,
  ADD COLUMN IF NOT EXISTS hanger_charge_cents integer,
  ADD COLUMN IF NOT EXISTS hanger_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS hanger_charge_status text CHECK (hanger_charge_status IN ('pending', 'charged', 'failed')),
  ADD COLUMN IF NOT EXISTS hanger_entered_by text,
  ADD COLUMN IF NOT EXISTS hanger_entered_at timestamptz;
