-- Add hourly wage to workers table (used for clock-in/out pay calculation)
-- Run in Supabase SQL editor

alter table workers
  add column if not exists hourly_wage_cents int not null default 0;
