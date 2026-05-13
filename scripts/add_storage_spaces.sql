-- ── Storage Spaces ────────────────────────────────────────────────────────────
-- Each facility can have one or more storage spaces (same or different addresses).
-- Storage spaces are the staging hub between customer pickup/delivery and the
-- wash facility. Transport runs move orders between a facility and a storage space.

create table if not exists storage_spaces (
  id              uuid primary key default gen_random_uuid(),
  location_id     uuid references locations(id) on delete cascade,
  facility_id     uuid references facilities(id) on delete cascade,

  -- Display
  name            text not null,
  address         text,
  unit            text,
  city            text,
  state           text default 'FL',
  zip             text,

  -- Capacity (optional, for planning)
  sq_ft           numeric,
  capacity_bags   integer,

  notes           text,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists storage_spaces_facility_idx on storage_spaces (facility_id);
create index if not exists storage_spaces_location_idx on storage_spaces (location_id);

-- Routes: default storage space
alter table routes
  add column if not exists default_storage_space_id uuid references storage_spaces(id) on delete set null;

-- Transport runs: specific storage space used for this run
alter table transport_runs
  add column if not exists storage_space_id uuid references storage_spaces(id) on delete set null;
