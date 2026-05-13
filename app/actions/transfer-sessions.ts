"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { revalidatePath } from "next/cache"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TransferSession {
  id: string
  driver_id: string
  direction: string
  facility_id: string | null
  status: string
  trip_count: number
  total_bags_moved: number
  started_at: string
  completed_at: string | null
  notes: string | null
}

export interface TransferTrip {
  id: string
  session_id: string
  trip_number: number
  bags_expected: number
  bags_loaded: number | null
  bags_unloaded: number | null
  status: string
  load_certified_at: string | null
  arrived_at: string | null
  unload_certified_at: string | null
  flag_note: string | null
}

export interface TripOrder {
  id: string
  trip_id: string
  booking_id: string
  bags_expected: number
  bags_loaded: number | null
  bags_unloaded: number | null
  needs_weighing: boolean
  load_certified_at: string | null
  unload_certified_at: string | null
  flag_type: string | null
  flag_note: string | null
  // joined
  customer_name?: string
  short_code?: string | null
  service_type?: string
  actual_weight_lbs?: number | null
}

// ── Start a new transfer session ──────────────────────────────────────────────

export async function startTransferSession(
  driverId: string,
  direction: "customer_to_storage" | "customer_to_facility" | "storage_to_facility" | "facility_to_storage",
  facilityId: string | null
): Promise<{ session?: TransferSession; error?: string }> {
  const supabase = createAdminClient()
  const locationId = await getLocationId()

  const { data, error } = await supabase
    .from("transfer_sessions")
    .insert({
      location_id: locationId,
      driver_id:   driverId,
      direction,
      facility_id: facilityId,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath("/driver")
  return { session: data as TransferSession }
}

// ── Get driver's active session ───────────────────────────────────────────────

export async function getActiveSession(driverId: string): Promise<TransferSession | null> {
  const supabase = createAdminClient()
  const locationId = await getLocationId()
  const { data } = await supabase
    .from("transfer_sessions")
    .select("*")
    .eq("location_id", locationId)
    .eq("driver_id", driverId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as TransferSession | null) ?? null
}

// ── Get orders available to add to a trip ────────────────────────────────────
// Returns orders in the right phase for this direction that aren't already in an active trip

export async function getOrdersForSession(
  sessionId: string,
  direction: string,
  facilityId: string | null
): Promise<{ id: string; short_code: string | null; customer_name: string; service_type: string; num_bags: number; phase: string; actual_weight_lbs: number | null }[]> {
  const supabase = createAdminClient()
  const locationId = await getLocationId()

  // Which phases are the source for this direction?
  const sourcePhase: Record<string, string[]> = {
    customer_to_storage:   ["picked_up"],
    customer_to_facility:  ["picked_up"],
    storage_to_facility:   ["at_storage"],
    facility_to_storage:   ["ready"],
  }
  const phases = sourcePhase[direction] ?? []

  let query = supabase
    .from("bookings")
    .select("id, short_code, customer_name, service_type, num_bags, phase, actual_weight_lbs")
    .eq("location_id", locationId)
    .in("phase", phases)

  if (facilityId) {
    query = query.eq("assigned_facility_id", facilityId)
  }

  const { data } = await query.order("pickup_date", { ascending: true })

  // Exclude orders already in an active trip for this session
  const { data: activeOrders } = await supabase
    .from("transfer_trip_orders")
    .select("booking_id, transfer_trips!inner(session_id, status)")
    .eq("transfer_trips.session_id", sessionId)
    .neq("transfer_trips.status", "complete")

  const activeBookingIds = new Set((activeOrders ?? []).map((o: { booking_id: string }) => o.booking_id))

  return ((data ?? []) as { id: string; short_code: string | null; customer_name: string; service_type: string; num_bags: number; phase: string; actual_weight_lbs: number | null }[])
    .filter(o => !activeBookingIds.has(o.id))
}

// ── Create a new trip within a session ───────────────────────────────────────

export async function startTrip(
  sessionId: string,
  orderIds: string[],  // booking IDs going in this trip
  direction: string
): Promise<{ trip?: TransferTrip; error?: string }> {
  const supabase = createAdminClient()
  const locationId = await getLocationId()

  // Get current trip count for this session
  const { data: session } = await supabase
    .from("transfer_sessions")
    .select("trip_count")
    .eq("id", sessionId)
    .single()

  const tripNumber = (session?.trip_count ?? 0) + 1

  // Get bag counts and weighing status for each order
  const { data: orders } = await supabase
    .from("bookings")
    .select("id, num_bags, actual_weight_lbs")
    .in("id", orderIds)

  const totalBags = (orders ?? []).reduce((sum: number, o: { num_bags: number }) => sum + (o.num_bags ?? 1), 0)

  // Create the trip
  const { data: trip, error: tripError } = await supabase
    .from("transfer_trips")
    .insert({
      session_id:    sessionId,
      location_id:   locationId,
      trip_number:   tripNumber,
      bags_expected: totalBags,
    })
    .select()
    .single()

  if (tripError) return { error: tripError.message }

  // Create trip order records
  const isFirstDropOff = ["customer_to_storage", "customer_to_facility"].includes(direction)

  const tripOrderRows = (orders ?? []).map((o: { id: string; num_bags: number; actual_weight_lbs: number | null }) => ({
    trip_id:        trip.id,
    booking_id:     o.id,
    location_id:    locationId,
    bags_expected:  o.num_bags ?? 1,
    needs_weighing: isFirstDropOff && !o.actual_weight_lbs,
  }))

  await supabase.from("transfer_trip_orders").insert(tripOrderRows)

  // Move orders to in_transit phase
  await supabase
    .from("bookings")
    .update({
      phase:            "in_transit",
      phase_updated_at: new Date().toISOString(),
    })
    .in("id", orderIds)

  // Log phase transitions — from_phase depends on the direction
  const sourcePhaseMap: Record<string, string> = {
    customer_to_storage:  "picked_up",
    customer_to_facility: "picked_up",
    storage_to_facility:  "at_storage",
    facility_to_storage:  "ready",
  }
  const transitionRows = orderIds.map(id => ({
    booking_id:  id,
    location_id: locationId,
    from_phase:  sourcePhaseMap[direction] ?? "at_storage",
    to_phase:    "in_transit",
    source:      "driver_app",
    trip_id:     trip.id,
  }))
  await supabase.from("phase_transitions").insert(transitionRows)

  // Increment session trip count
  await supabase
    .from("transfer_sessions")
    .update({ trip_count: tripNumber })
    .eq("id", sessionId)

  revalidatePath("/driver")
  revalidatePath("/admin/facility")
  return { trip: trip as TransferTrip }
}

// ── Certify load count ────────────────────────────────────────────────────────

export async function certifyTripLoaded(
  tripId: string,
  bagsLoaded: number
): Promise<{ error?: string; flagged?: boolean }> {
  const supabase = createAdminClient()

  const { data: trip } = await supabase
    .from("transfer_trips")
    .select("bags_expected")
    .eq("id", tripId)
    .single()

  const flagged = trip && bagsLoaded !== trip.bags_expected

  await supabase
    .from("transfer_trips")
    .update({
      bags_loaded:       bagsLoaded,
      load_certified_at: new Date().toISOString(),
      status:            flagged ? "flagged" : "in_transit",
      flag_note:         flagged ? `Loaded ${bagsLoaded}, expected ${trip?.bags_expected}` : null,
    })
    .eq("id", tripId)

  revalidatePath("/driver")
  return { flagged: !!flagged }
}

// ── Certify arrival + unload (with per-bag weights if needed) ─────────────────

export async function certifyTripUnloaded(input: {
  tripId: string
  sessionId: string
  bagsUnloaded: number
  direction: string
  bagWeights?: { bookingId: string; weights: number[] }[]  // per-order bag weights
  workerId: string | null
  workerName: string | null
}): Promise<{ error?: string; flagged?: boolean }> {
  const supabase = createAdminClient()
  const locationId = await getLocationId()
  const { tripId, sessionId, bagsUnloaded, direction, bagWeights, workerId, workerName } = input

  const { data: trip } = await supabase
    .from("transfer_trips")
    .select("bags_expected, bags_loaded")
    .eq("id", tripId)
    .single()

  const flagged = trip && bagsUnloaded !== (trip.bags_loaded ?? trip.bags_expected)

  // Update trip
  await supabase
    .from("transfer_trips")
    .update({
      bags_unloaded:       bagsUnloaded,
      arrived_at:          new Date().toISOString(),
      unload_certified_at: new Date().toISOString(),
      status:              flagged ? "flagged" : "complete",
      flag_note:           flagged ? `Unloaded ${bagsUnloaded}, loaded ${trip?.bags_loaded ?? "?"}` : null,
    })
    .eq("id", tripId)

  // Save per-bag weights if this is a first drop-off
  if (bagWeights && bagWeights.length > 0) {
    for (const { bookingId, weights } of bagWeights) {
      if (weights.length === 0) continue

      const weightRows = weights.map((w, i) => ({
        booking_id:  bookingId,
        location_id: locationId,
        bag_number:  i + 1,
        weight_lbs:  w,
        recorded_by: workerId ?? null,
      }))

      await supabase
        .from("order_bag_weights")
        .upsert(weightRows, { onConflict: "booking_id,bag_number" })

      // Sum and save to booking
      const totalWeight = weights.reduce((a, b) => a + b, 0)
      await supabase
        .from("bookings")
        .update({
          actual_weight_lbs: totalWeight,
          weight_entered_by: workerName ?? "driver",
          weight_entered_at: new Date().toISOString(),
        })
        .eq("id", bookingId)
    }
  }

  // Determine destination phase
  // "at_storage" = fresh pickup, never processed — waiting for facility transfer
  // "staged"     = processed, returned to storage — waiting for delivery route
  const destPhase: Record<string, string> = {
    customer_to_storage:  "at_storage",
    customer_to_facility: "intake",
    storage_to_facility:  "intake",
    facility_to_storage:  "staged",
  }
  const newPhase = destPhase[direction] ?? "at_storage"

  // Get orders in this trip
  const { data: tripOrders } = await supabase
    .from("transfer_trip_orders")
    .select("booking_id, bags_expected")
    .eq("trip_id", tripId)

  const orderIds = (tripOrders ?? []).map((o: { booking_id: string }) => o.booking_id)

  // Move orders to destination phase
  await supabase
    .from("bookings")
    .update({
      phase:            newPhase,
      phase_updated_at: new Date().toISOString(),
      phase_updated_by: workerId ?? null,
    })
    .in("id", orderIds)

  // Log phase transitions
  const now = new Date().toISOString()
  const transitionRows = orderIds.map((id: string) => ({
    booking_id:  id,
    location_id: locationId,
    from_phase:  "in_transit",
    to_phase:    newPhase,
    worker_id:   workerId ?? null,
    worker_name: workerName ?? null,
    source:      "driver_app",
    trip_id:     tripId,
  }))
  await supabase.from("phase_transitions").insert(transitionRows)

  // Update session total bags moved
  await supabase.rpc("increment_session_bags", {
    p_session_id: sessionId,
    p_count:      bagsUnloaded,
  }).maybeSingle()
  // Fallback if rpc not available
  const { data: sess } = await supabase
    .from("transfer_sessions")
    .select("total_bags_moved")
    .eq("id", sessionId)
    .single()
  await supabase
    .from("transfer_sessions")
    .update({ total_bags_moved: (sess?.total_bags_moved ?? 0) + bagsUnloaded })
    .eq("id", sessionId)

  // Log order events
  const eventRows = orderIds.map((id: string) => ({
    booking_id:  id,
    event_type:  "phase_changed",
    notes:       `Arrived at ${newPhase.replace(/_/g, " ")} — certified by ${workerName ?? "driver"}`,
    created_by:  workerName ?? "driver",
  }))
  await supabase.from("order_events").insert(eventRows)

  revalidatePath("/driver")
  revalidatePath("/admin/facility")
  return { flagged: !!flagged }
}

// ── Complete a session ────────────────────────────────────────────────────────

export async function completeSession(sessionId: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("transfer_sessions")
    .update({
      status:       "complete",
      completed_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
  if (error) return { error: error.message }
  revalidatePath("/driver")
  return {}
}

// ── Get current trip for a session (if any is in progress) ───────────────────

export async function getActiveTrip(sessionId: string): Promise<(TransferTrip & { orders: TripOrder[] }) | null> {
  const supabase = createAdminClient()

  const { data: trip } = await supabase
    .from("transfer_trips")
    .select("*")
    .eq("session_id", sessionId)
    .in("status", ["loading", "in_transit", "unloading", "flagged"])
    .order("trip_number", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!trip) return null

  const { data: tripOrders } = await supabase
    .from("transfer_trip_orders")
    .select(`
      *,
      bookings (customer_name, short_code, service_type, actual_weight_lbs)
    `)
    .eq("trip_id", trip.id)

  const orders: TripOrder[] = (tripOrders ?? []).map((o: {
    id: string; trip_id: string; booking_id: string; bags_expected: number;
    bags_loaded: number | null; bags_unloaded: number | null; needs_weighing: boolean;
    load_certified_at: string | null; unload_certified_at: string | null;
    flag_type: string | null; flag_note: string | null;
    bookings: { customer_name: string; short_code: string | null; service_type: string; actual_weight_lbs: number | null }
  }) => ({
    id:                  o.id,
    trip_id:             o.trip_id,
    booking_id:          o.booking_id,
    bags_expected:       o.bags_expected,
    bags_loaded:         o.bags_loaded,
    bags_unloaded:       o.bags_unloaded,
    needs_weighing:      o.needs_weigh