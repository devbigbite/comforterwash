"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId, getBranding } from "@/lib/location"
import { sendSMS } from "@/lib/sms"
import { sendPickupReminderToCustomer } from "@/lib/email"

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

export async function getDriverQueue(driverId: string): Promise<{
  pickups: DriverOrder[]
  deliveries: DriverOrder[]
  routeAlreadyStarted: boolean
}> {
  if (!driverId) return { pickups: [], deliveries: [], routeAlreadyStarted: false }

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date())

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
    .select("id, short_code, customer_name, customer_address, pickup_date, delivery_date, status, service_type, num_bags")
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
    .select("id, short_code, customer_name, customer_address, pickup_date, delivery_date, status, service_type, num_bags")
    .eq("location_id", locationId)
    .lte("delivery_date", today)
    .in("status", ["ready", "ready_at_warehouse", "out_for_delivery"])
    .order("delivery_date")
  if (!isOwner) deliveriesQuery = deliveriesQuery.eq("assigned_delivery_driver_id", driverId)

  const [{ data: pickups }, { data: deliveries }] = await Promise.all([pickupsQuery, deliveriesQuery])
  const pickupList = (pickups ?? []) as DriverOrder[]

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
    deliveries: (deliveries ?? []) as DriverOrder[],
    routeAlreadyStarted,
  }
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
