-- Migration: add Shipday order IDs to bookings for real-time route patching
-- Applied: 2026-05-06

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS shipday_pickup_order_id bigint,
  ADD COLUMN IF NOT EXISTS shipday_delivery_order_id bigint;

CREATE INDEX IF NOT EXISTS bookings_shipday_pickup_idx
  ON public.bookings(shipday_pickup_order_id)
  WHERE shipday_pickup_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS bookings_shipday_delivery_idx
  ON public.bookings(shipday_delivery_order_id)
  WHERE shipday_delivery_order_id IS NOT NULL;
