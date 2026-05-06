-- Migration: route time windows + turnaround days
-- Run this in the Supabase SQL editor

-- 1. Add turnaround_days to routes (default 3 for existing routes)
ALTER TABLE routes ADD COLUMN IF NOT EXISTS turnaround_days integer NOT NULL DEFAULT 3;

-- 2. Create route_time_windows table
CREATE TABLE IF NOT EXISTS route_time_windows (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id        uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  start_time      text NOT NULL,   -- "09:00" (24-hour)
  end_time        text NOT NULL,   -- "13:00" (24-hour)
  label           text NOT NULL,   -- "9:00 AM – 1:00 PM" (display)
  max_bookings    integer,         -- NULL = unlimited
  is_private      boolean NOT NULL DEFAULT false,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamp with time zone DEFAULT now()
);

-- Index for fast lookups by route
CREATE INDEX IF NOT EXISTS route_time_windows_route_id_idx ON route_time_windows(route_id);
