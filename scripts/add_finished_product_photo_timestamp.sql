-- The three order_events-backed photos (Customer Pickup, Facility Drop-off,
-- Customer Delivery) already have a timestamp for free -- order_events.created_at.
-- The Finished Product & Facility Location photo is the odd one out: it's
-- stored directly on bookings.facility_floor_photo_url (see
-- app/actions/facility-board.ts updateFacilityDetails), not as an
-- order_event, so it has never had a "when was this taken" field.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS facility_floor_photo_taken_at timestamptz;
