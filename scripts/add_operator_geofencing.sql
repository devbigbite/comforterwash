-- Geofencing for operator clock-in/out (Cassie's request, 2026-09-15).
-- Deliberately flag-only, never blocking -- mobile geolocation is
-- unreliable indoors at a facility, and a hard block risks locking out a
-- legitimate worker over a bad GPS reading. See app/actions/staff.ts.

ALTER TABLE public.facilities
  ADD COLUMN IF NOT EXISTS geofence_lat numeric,
  ADD COLUMN IF NOT EXISTS geofence_lng numeric,
  -- Radius in miles. NULL = geofencing off for this facility (e.g. Perfect
  -- Spin, which has no address on file yet) -- never block/flag with no
  -- configured center point.
  ADD COLUMN IF NOT EXISTS geofence_radius_miles numeric;

ALTER TABLE public.staff_time_punches
  ADD COLUMN IF NOT EXISTS clock_in_lat numeric,
  ADD COLUMN IF NOT EXISTS clock_in_lng numeric,
  ADD COLUMN IF NOT EXISTS clock_in_distance_miles numeric,
  ADD COLUMN IF NOT EXISTS clock_in_out_of_range boolean,
  ADD COLUMN IF NOT EXISTS clock_out_lat numeric,
  ADD COLUMN IF NOT EXISTS clock_out_lng numeric,
  ADD COLUMN IF NOT EXISTS clock_out_distance_miles numeric,
  ADD COLUMN IF NOT EXISTS clock_out_out_of_range boolean;
