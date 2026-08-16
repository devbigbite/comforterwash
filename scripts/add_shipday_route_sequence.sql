-- Migration: capture Shipday's optimized route sequence number per leg
-- Lets our own driver queue (app/actions/driver-queue.ts) sort stops in the
-- same order Shipday's route optimizer produced, instead of only date order
-- or straight-line distance from the driver's start point. Populated by the
-- Shipday webhook (app/api/shipday/webhook/[secret]/route.ts) and, as a
-- fallback, by the poller (lib/shipday-sync.ts) — same two ingestion paths
-- already used for delivery-status sync.
--
-- Two separate columns because pickup and delivery are two separate Shipday
-- orders (see shipday_pickup_order_id / shipday_delivery_order_id) that can
-- end up in different routes with different sequence numbers.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS shipday_pickup_sequence integer,
  ADD COLUMN IF NOT EXISTS shipday_delivery_sequence integer;
