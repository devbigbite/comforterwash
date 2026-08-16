-- Migration: manual stop-order override for tenants not using Shipday
-- (or for any driver's stops a dispatcher wants to hand-order regardless).
-- One column, not split by pickup/delivery leg like the Shipday sequence
-- columns — a given booking only ever sits in ONE of the driver queue's two
-- lists at a time (pickup leg or delivery leg, based on current status; see
-- legFor() in app/admin/dispatch/page.tsx and app/actions/driver-queue.ts),
-- so there's no case where the same booking needs two different manual
-- positions simultaneously.
--
-- Set by dragging cards in the "Today" group of a driver's column on the
-- dispatch board (components/admin/DispatchBoard.tsx's ReorderableTodayList)
-- via setManualRouteOrder() in app/actions/driver-queue.ts. Read by
-- getDriverQueue()'s sortBySequence() as the fallback when a booking has no
-- Shipday sequence number — Shipday's real route-optimizer result always
-- wins over a dispatcher's manual guess when both exist for the same stop.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS manual_route_sequence integer;
