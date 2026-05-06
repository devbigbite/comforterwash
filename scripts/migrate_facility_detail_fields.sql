-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS phone                  TEXT,
  ADD COLUMN IF NOT EXISTS manager                TEXT,
  ADD COLUMN IF NOT EXISTS owner                  TEXT,
  ADD COLUMN IF NOT EXISTS hours_open             TEXT,
  ADD COLUMN IF NOT EXISTS storage_level          INTEGER CHECK (storage_level IN (1, 2, 3)),
  ADD COLUMN IF NOT EXISTS has_processing_limit   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS processing_limit_days  INTEGER,
  ADD COLUMN IF NOT EXISTS processing_limit_hours NUMERIC(5,1);
