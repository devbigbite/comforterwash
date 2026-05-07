-- ─────────────────────────────────────────────────────────────────
-- Staff Clock In / Out + Scheduled Shifts
-- Run this in the Supabase SQL editor
-- ─────────────────────────────────────────────────────────────────

-- Clock in / out records (actual time worked)
create table if not exists staff_time_punches (
  id              uuid primary key default gen_random_uuid(),
  worker_name     text not null,
  role            text not null check (role in ('driver', 'operator', 'admin')),
  clocked_in_at   timestamptz not null default now(),
  clocked_out_at  timestamptz,                 -- null means currently clocked in
  break_minutes   int not null default 0,      -- manual break deduction
  notes           text,
  created_at      timestamptz not null default now()
);

-- Index for "who's clocked in right now" query
create index if not exists staff_punches_open_idx
  on staff_time_punches (worker_name, clocked_in_at desc)
  where clocked_out_at is null;

-- Index for time sheet range queries
create index if not exists staff_punches_date_idx
  on staff_time_punches (clocked_in_at desc);

-- ─────────────────────────────────────────────────────────────────
-- Admin-created scheduled shifts (planned roster)
-- ─────────────────────────────────────────────────────────────────
create table if not exists staff_scheduled_shifts (
  id            uuid primary key default gen_random_uuid(),
  worker_name   text not null,
  role          text not null check (role in ('driver', 'operator', 'admin')),
  shift_date    date not null,
  start_time    time not null,    -- e.g. '09:00'
  end_time      time not null,    -- e.g. '17:00'
  notes         text,
  created_at    timestamptz not null default now()
);

-- Index for weekly schedule queries
create index if not exists staff_shifts_date_idx
  on staff_scheduled_shifts (shift_date, worker_name);
