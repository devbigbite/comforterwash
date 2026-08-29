"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId, getBranding, getLocationTimezone } from "@/lib/location"
import { sendSMS } from "@/lib/sms"
import { sendPickupReminderToCustomer } from "@/lib/email"
import { geocodeAddress, distanceMiles, type LatLng } from "@/lib/geocoding"
import { requireAdmin } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"

export interface DriverOrder {
  id: string
  short_code: string | null
  customer_name: string
  customer_address: string
  pickup_date: string
  delivery_date: string
  status: string
  service_type: string
  num_bags: number
}

// Orders by Shipday's optimized route position (lower stop number first)
// when present — this is a real multi-stop optimization, so it takes
// priority over the straight-line-distance fallback below. Any order with
// no sequence number (tenant doesn't use Shipday, or this particular stop
// was never added to a Shipday route) keeps whatever position it already
// had from the sort applied before this — Array.sort is stable, so passing
// in an already date/distance-sorted list here just moves the sequenced
// stops into their optimized slots and leaves everything else untouched.
function sortBySequence<T extends { __sequence: number | null }>(orders: T[]): T[] {
  return [...orders].sort((a, b) => {
    if (a.__sequence == null && b.__sequence == null) return 0
    if (a.__sequence == null) return 1
    if (b.__sequence == null) return -1
    return a.__sequence - b.__sequence
  })
}

export async function getDriverQueue(driverId: string): Promise<{
  pickups: DriverOrder[]
  deliveries: DriverOrder[]
  routeAlreadyStarted: boolean
}> {
  if (!driverId) return { pickups: [], deliveries: [], routeAlreadyStarted: false }

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: await getLocationTimezone(locationId) }).format(new Date())

  // The "owner" sentinel worker (admin using the "Enter as Owner" bypass on
  // the driver station) sees every in-progress pickup/delivery for the whole
  // location, unfiltered by assigned_driver_id — matching the oversight
  // access owners already get on the operator side (see getOperatorQueue in
  // operator-queue.ts). This used to return an empty queue for "owner"
  // entirely, which made the admin bypass look broken/unusable the moment
  // anyone actually tried it.
  const isOwner = driverId === "owner"

  // lte (not eq) on purpose — a booking whose pickup/delivery date has
  // already passed but is still sitting in an unfinished status (e.g. a
  // pickup that was scheduled but never actually happened) needs to stay
  // visible to the driver as overdue, not silently vanish from their queue
  // once the day rolls over. The admin dispatch board already shows these
  // regardless of date; before this fix the driver's own view disagreed
  // with it and dropped them entirely — a real order could be assigned to a
  // driver in the admin view yet never appear on that driver's phone.
  let pickupsQuery = supabase
    .from("bookings")
    .select("id, short_code, customer_name, customer_address, pickup_date, delivery_date, status, service_type, num_bags, address_lat, address_lng, shipday_pickup_sequence, manual_route_sequence")
    .eq("location_id", locationId)
    .lte("pickup_date", today)
    .in("status", ["confirmed", "picked_up"])
    .order("pickup_date")
  if (!isOwner) pickupsQuery = pickupsQuery.eq("assigned_driver_id", driverId)

  // Filtered on assigned_delivery_driver_id, not assigned_driver_id — the
  // driver who picked this order up from the customer is not necessarily
  // the one delivering the finished product back. Those are tracked as two
  // separate columns on bookings (see migration add_assigned_delivery_driver_id
  // and app/admin/dispatch/page.tsx's legFor()); before this fix a driver's
  // "Deliveries" tab was really showing whoever did the pickup, which could
  // be a completely different person from who's actually supposed to run
  // this delivery.
  let deliveriesQuery = supabase
    .from("bookings")
    .select("id, short_code, customer_name, customer_address, pickup_date, delivery_date, status, service_type, num_bags, address_lat, address_lng, shipday_delivery_sequence, manual_route_sequence")
    .eq("location_id", locationId)
    .lte("delivery_date", today)
    .in("status", ["ready", "ready_at_warehouse", "out_for_delivery"])
    .order("delivery_date")
  if (!isOwner) deliveriesQuery = deliveriesQuery.eq("assigned_delivery_driver_id", driverId)

  // Driver's route starting point (Admin -> Workers -> [driver] -> Route
  // Starting Point), if one has been set. "owner" has no worker row, so it
  // never gets distance sorting — falls back to plain date ordering, same
  // as any driver with no starting point configured.
  let startPoint: LatLng | null = null
  if (!isOwner) {
    const { data: worker } = await supabase
      .from("workers")
      .select("route_start_lat, route_start_lng")
      .eq("id", driverId)
      .eq("location_id", locationId)
      .maybeSingle()
    if (worker?.route_start_lat != null && worker?.route_start_lng != null) {
      startPoint = { lat: worker.route_start_lat as number, lng: worker.route_start_lng as number }
    }
  }

  const [{ data: pickups }, { data: deliveries }] = await Promise.all([pickupsQuery, deliveriesQuery])
  let pickupList    = (pickups ?? [])    as (DriverOrder & { address_lat: number | null; address_lng: number | null; shipday_pickup_sequence: number | null; manual_route_sequence: number | null })[]
  let deliveryList  = (deliveries ?? []) as (DriverOrder & { address_lat: number | null; address_lng: number | null; shipday_delivery_sequence: number | null; manual_route_sequence: number | null })[]

  if (startPoint) {
    pickupList   = await sortByDistanceFromStart(supabase, pickupList, startPoint)
    deliveryList = await sortByDistanceFromStart(supabase, deliveryList, startPoint)
  }

  // Sequence priority: Shipday's real route-optimizer result first (when
  // this tenant uses Shipday and this stop has been routed there), then a
  // dispatcher's manual drag-to-reorder override (see setManualRouteOrder
  // below — this is the only ordering signal available to a tenant that
  // doesn't use Shipday at all), then whatever the distance/date fallback
  // above already produced.
  pickupList = sortBySequence(pickupList.map(o => ({ ...o, __sequence: o.shipday_pickup_sequence ?? o.manual_route_sequence })))
    .map(({ __sequence, ...rest }) => rest) as typeof pickupList
  deliveryList = sortBySequence(deliveryList.map(o => ({ ...o, __sequence: o.shipday_delivery_sequence ?? o.manual_route_sequence })))
    .map(({ __sequence, ...rest }) => rest) as typeof deliveryList

  // The "Start Route — Notify All Customers" button's on-screen state was
  // previously plain client useState, reset to unclicked on every page
  // load/navigation — so a driver who tapped it, then left and came back to
  // the page (as happened here), saw the button lit up again as if nothing
  // had happened, even though notifyRouteStart is itself idempotent and
  // wouldn't re-send. Confusing and, if someone assumed the idempotency
  // guard away, risked a driver tapping it "just to be safe" on a route that
  // was already notified. Deriving the initial state from whether today's
  // pickups already have a driver_enroute_pickup event fixes the display to
  // match reality on load, not just within a single session.
  let routeAlreadyStarted = false
  if (pickupList.length) {
    const { data: notifiedEvents } = await supabase
      .from("order_events")
      .select("booking_id")
      .eq("event_type", "driver_enroute_pickup")
      .in("booking_id", pickupList.map(p => p.id))
    const notifiedIds = new Set((notifiedEvents ?? []).map(e => e.booking_id as string))
    routeAlreadyStarted = pickupList.every(p => notifiedIds.has(p.id))
  }

  return {
    pickups:    pickupList,
    deliveries: deliveryList,
    routeAlreadyStarted,
  }
}

// ── Manual stop order (dispatch board drag-and-drop) ──────────────────────
// The reorder counterpart to the Shipday sequence columns, for tenants that
// don't use Shipday's route optimizer (or for a dispatcher who just wants to
// override it for one day). Called from the dispatch board with the full
// list of booking ids for one driver's "Today" lane, in the exact order the
// dispatcher dropped them in — writes 1, 2, 3... across that list.
//
// Deliberately whole-list-replace, not a single before/after move: a native
// HTML5 drag-and-drop reorder already computes the full new order client-side
// (see ReorderableTodayList in components/admin/DispatchBoard.tsx), so
// there's no reason to reconstruct that server-side from a single dropped
// index — and always sending the complete list means a dropped or
// out-of-order request can never leave two stops sharing the same number.
//
// Scoped to the given location so a dispatcher session for one tenant can't
// reorder another tenant's bookings even if it somehow had the ids.
export async function setManualRouteOrder(bookingIdsInOrder: string[]): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  if (!bookingIdsInOrder.length) return { ok: true }

  const supabase = createAdminClient()
  const locationId = await getLocationId()

  // One update per row rather than a bulk upsert — this table doesn't have
  // a natural "values list" write path through supabase-js, and this list
  // is always small (one driver's stops for one day), so the extra
  // round-trips aren't a real cost here.
  const results = await Promise.all(
    bookingIdsInOrder.map((id, i) =>
      supabase.from("bookings")
        .update({ manual_route_sequence: i + 1 })
        .eq("id", id)
        .eq("location_id", locationId)
    )
  )

  const failed = results.find(r => r.error)
  if (failed?.error) {
    console.error("[driver-queue] setManualRouteOrder failed:", failed.error)
    return { ok: false, error: failed.error.message }
  }

  revalidatePath("/admin/dispatch")
  return { ok: true }
}

// ── Distance sort ─────────────────────────────────────────────────────────
// Orders each pass by straight-line distance from the driver's route
// starting point. Best-effort: any address that fails to geocode (bad
// address, geocoding API unavailable, etc.) sorts to the end rather than
// blocking the whole list — a driver should never see an empty queue just
// because one address couldn't be resolved.
async function sortByDistanceFromStart<T extends { id: string; customer_address: string; address_lat: number | null; address_lng: number | null }>(
  supabase: ReturnType<typeof createAdminClient>,
  orders: T[],
  start: LatLng,
): Promise<T[]> {
  const withDistance = await Promise.all(orders.map(async (order) => {
    let point: LatLng | null = order.address_lat != null && order.address_lng != null
      ? { lat: order.address_lat, lng: order.address_lng }
      : null

    if (!point && order.customer_address) {
      point = await geocodeAddress(order.customer_address)
      if (point) {
        // Cache so the next queue load (or the delivery pass on this same
        // booking) doesn't re-geocode the same address.
        await supabase.from("bookings").update({ address_lat: point.lat, address_lng: point.lng }).eq("id", order.id)
      }
    }

    return { order, distance: point ? distanceMiles(start, point) : Infinity }
  }))

  return withDistance
    .sort((a, b) => a.distance - b.distance)
    .map(w => w.order)
}

// ── Notify every customer on today's pickup route at once ────────────────────
// Fired when the driver taps "Start Route" — BEFORE arriving at any stop —
// so every customer on the route gets the "please leave your laundry out"
// SMS + email at the same time, not one-by-one as the driver reaches each
// address. Skips any booking that's already been notified (idempotent —
// safe if the driver taps it again or reloads the page).
export async function notifyRouteStart(bookingIds: string[]): Promise<{
  smsSent: number; emailSent: number; skipped: number; errors: string[]
}> {
  if (!bookingIds.length) return { smsSent: 0, emailSent: 0, skipped: 0, errors: [] }

  const supabase = createAdminClient()

  // Filter out bookings already notified this run (idempotency guard)
  const { data: already } = await supabase
    .from("order_events")
    .select("booking_id")
    .eq("event_type", "driver_enroute_pickup")
    .in("booking_id", bookingIds)
  const alreadyNotified = new Set((already ?? []).map(e => e.booking_id as string))
  const toNotify = bookingIds.filter(id => !alreadyNotified.has(id))

  if (!toNotify.length) {
    return { smsSent: 0, emailSent: 0, skipped: bookingIds.length, errors: [] }
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, customer_name, customer_phone, customer_email, customer_address, pickup_time_window, service_type, location_id")
    .in("id", toNotify)

  let smsSent = 0
  let emailSent = 0
  const errors: string[] = []
  const brandingCache = new Map<string, Awaited<ReturnType<typeof getBranding>>>()
  async function brandingFor(locationId: string | null) {
    const key = locationId ?? "__default__"
    if (!brandingCache.has(key)) brandingCache.set(key, await getBranding(locationId ?? undefined))
    return brandingCache.get(key)!
  }

  for (const booking of bookings ?? []) {
    const firstName  = booking.customer_name?.split(" ")[0] ?? "there"
    const timeWindow = booking.pickup_time_window ?? "your scheduled time"
    const branding   = await brandingFor(booking.location_id)

    if (booking.customer_phone) {
      const msg = `Hi ${firstName}! ${branding.business_name} will be picking up your laundry today between ${timeWindow}. Please have it ready!`
      const result = await sendSMS(booking.customer_phone, msg)
      if (result.success) smsSent++
      else errors.push(`SMS ${booking.id}: ${result.error}`)
    }

    if (booking.customer_email) {
      try {
        await sendPickupReminderToCustomer(booking.customer_email, {
          customerName:     booking.customer_name ?? "Valued Customer",
          pickupDate:       "today",
          pickupTimeWindow: timeWindow,
          pickupAddress:    booking.customer_address ?? "",
          serviceType:      booking.service_type ?? "laundry",
        }, booking.location_id ?? undefined)
        emailSent++
      } catch (err) {
        errors.push(`Email ${booking.id}: ${String(err)}`)
      }
    }

    await supabase.from("order_events").insert({
      booking_id: booking.id,
      event_type: "driver_enroute_pickup",
      notes:      "Driver started the route — customer notified to leave laundry out",
      created_by: "driver",
    })
  }

  return { smsSent, emailSent, skipped: alreadyNotified.size, errors }
}
