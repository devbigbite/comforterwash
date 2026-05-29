-- Add Stripe Connect fields to facilities
ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN DEFAULT FALSE;

-- Facility payouts ledger
CREATE TABLE IF NOT EXISTS facility_payouts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id         UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  location_id         UUID REFERENCES locations(id),
  amount_cents        INTEGER NOT NULL,
  stripe_transfer_id  TEXT,
  period_from         DATE,
  period_to           DATE,
  orders_count        INTEGER,
  total_lbs           NUMERIC(8,2),
  status              TEXT NOT NULL DEFAULT 'pending',
  notes               TEXT,
  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS facility_payouts_facility_id_idx ON facility_payouts(facility_id);
