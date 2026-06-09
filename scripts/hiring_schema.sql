-- ── Hiring schema additions ───────────────────────────────────────────────────
-- Run once in the Supabase SQL editor.

-- 1. Add IC agreement signature fields to workers
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS ic_agreement_signed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS ic_agreement_signature   text,
  ADD COLUMN IF NOT EXISTS ic_agreement_role        text;

-- 2. Worker documents (1099s, signed agreements, etc.)
CREATE TABLE IF NOT EXISTS worker_documents (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id     uuid          NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  location_id   uuid          REFERENCES locations(id),
  document_type text          NOT NULL DEFAULT 'other',
  -- ^ values: '1099', 'ic_agreement', 'id_verification', 'other'
  file_name     text          NOT NULL,
  storage_path  text,         -- Supabase storage path (worker-docs bucket)
  external_url  text,         -- OR a Google Drive / Dropbox link
  notes         text,
  created_at    timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS worker_documents_worker_id_idx ON worker_documents(worker_id);

-- 3. Worker mileage reports (drivers)
CREATE TABLE IF NOT EXISTS worker_mileage_reports (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id    uuid        NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  location_id  uuid        REFERENCES locations(id),
  report_date  date        NOT NULL DEFAULT CURRENT_DATE,
  description  text        NOT NULL,  -- trip purpose / route
  miles        numeric(8,1) NOT NULL,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS worker_mileage_reports_worker_id_idx ON worker_mileage_reports(worker_id);

-- 4. RLS: admin-only (same pattern as other admin tables)
ALTER TABLE worker_documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_mileage_reports  ENABLE ROW LEVEL SECURITY;

-- Service-role key bypasses RLS, so these policies just block anon/public access.
CREATE POLICY "Admin only" ON worker_documents
  USING (auth.role() = 'service_role');

CREATE POLICY "Admin only" ON worker_mileage_reports
  USING (auth.role() = 'service_role');

-- 5. Supabase Storage bucket (run in dashboard Storage tab OR via this SQL)
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES ('worker-docs', 'worker-docs', false, 10485760,
--   ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
-- ON CONFLICT (id) DO NOTHING;
