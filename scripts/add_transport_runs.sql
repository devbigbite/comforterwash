-- ─────────────────────────────────────────────────────────────────
-- Transport Runs — batch warehouse ↔ facility transport jobs
-- Run this in the Supabase SQL editor
-- ─────────────────────────────────────────────────────────────────

create table if not exists transport_runs (
  id                uuid primary key default gen_random_uuid(),

  -- 'to_facility'  : warehouse → processing facility (orders: at_warehouse → at_facility)
  -- 'to_warehouse' : processing facility → warehouse  (orders: ready → ready_at_warehouse)
  run_type          text not null check (run_type in ('to_facility', 'to_warehouse')),

  -- The facility involved (destination for to_facility, source for to_warehouse)
  facility_id       uuid references facilities(id) on delete set null,
  facility_name     text,           -- denormalised for display after deletion

  -- Assignment
  assigned_to       text not null,  -- worker name
  assigned_role     text not null check (assigned_role in ('driver', 'operator')),

  -- Orders included in this run (array of booking IDs)
  order_ids         uuid[] not null default '{}',

  -- Lifecycle
  status            text not null default 'pending'
                      check (status in ('pending', 'completed', 'cancelled')),
  notes             text,

  -- Photo taken at execution
  photo_url         text,

  -- Audit
  created_at        timestamptz not null default now(),
  completed_at      timestamptz,
  completed_by      text   -- name of whoever tapped Execute
);

-- Index for driver/operator home queries
create index if not exists transport_runs_status_role_idx
  on transport_runs (status, assigned_role);

-- Index for admin listing
create index if not exists transport_runs_created_idx
  on transport_runs (created_at desc);
