-- Track how a facility payout was settled: 'stripe' (Stripe Connect transfer)
-- or a manual method (cash / check / zelle / other) recorded after the fact.
-- Existing rows are all Stripe transfers, hence the default.
ALTER TABLE facility_payouts
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'stripe';

UPDATE facility_payouts SET payment_method = 'stripe'
  WHERE payment_method IS NULL OR payment_method = '';
