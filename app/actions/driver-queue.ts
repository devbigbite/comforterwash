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
}> {
  if (!driverId || driverId === "owner") return { pickups: [], deliveries: [] }

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date())

  const [{ data: pickups }, { data: deliveries }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, short_code, customer_name, customer_address, pickup_date, delivery_date, status, service_type, num_bags")
      .eq("location_id", locationId)
      .eq("pickup_date", today)
      .in("status", ["confirmed", "picked_up"])
      .eq("assigned_driver_id", driverId)
      .order("pickup_date"),
    supabase
      .from("bookings")
      .select("id, short_code, customer_name, customer_address, pickup_date, delivery_date, status, service_type, num_bags")
      .eq("location_id", locationId)
      .eq("delivery_date", today)
      .in("status", ["ready", "ready_at_warehouse", "out_for_delivery"])
      .eq("assigned_driver_id", driverId)
      .order("delivery_date"),
  ])

  return {
    pickups:    (pickups    ?? []) as DriverOrder[],
    deliveries: (deliveries ?? []) as DriverOrder[],
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
