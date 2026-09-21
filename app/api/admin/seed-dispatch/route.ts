import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"
import { getLocationId, getLocationTimezone } from "@/lib/location"

export async function POST() {
  await requireAdmin()
  const supabase = createAdminClient()
  const locationId = await getLocationId()
  const timezone = await getLocationTimezone(locationId)

  // Today in the current tenant's configured timezone.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date())
  const tomorrowDate = new Date(`${today}T12:00:00Z`)
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1)
  const tomorrow = tomorrowDate.toISOString().slice(0, 10)
  const demoEmail = "dispatch-demo@test.washfold"

  // Only touch records created by this demo tool. `WF-` is also the normal
  // short-code prefix for real wash-and-fold orders, so using that prefix as
  // the old sample-order selector could reschedule genuine customer orders.
  let { data: bookings, error } = await supabase
    .from("bookings")
    .select("id, short_code, status")
    .eq("location_id", locationId)
    .eq("customer_email", demoEmail)
    .order("short_code")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let created = 0
  if (!bookings?.length) {
    const { data: seeded, error: seedError } = await supabase
      .from("bookings")
      .insert([
        {
          location_id: locationId, customer_name: "Demo Pickup", customer_email: demoEmail,
          customer_phone: "5550000101", customer_address: "101 Demo Pickup Lane",
          service_type: "wash_fold", num_bags: 2, status: "confirmed", phase: "intake",
          pickup_date: today, delivery_date: tomorrow, pickup_time_window: "9am–12pm",
          delivery_time_window: "9am–12pm", price_per_lb_cents: 250,
        },
        {
          location_id: locationId, customer_name: "Demo In Transit", customer_email: demoEmail,
          customer_phone: "5550000102", customer_address: "202 Demo Transit Avenue",
          service_type: "wash_fold", num_bags: 2, status: "picked_up", phase: "pickup",
          pickup_date: today, delivery_date: tomorrow, pickup_time_window: "9am–12pm",
          delivery_time_window: "9am–12pm", price_per_lb_cents: 250,
        },
        {
          location_id: locationId, customer_name: "Demo Delivery", customer_email: demoEmail,
          customer_phone: "5550000103", customer_address: "303 Demo Delivery Road",
          service_type: "wash_fold", num_bags: 2, status: "out_for_delivery", phase: "delivery",
          pickup_date: today, delivery_date: today, pickup_time_window: "9am–12pm",
          delivery_time_window: "9am–12pm", price_per_lb_cents: 250,
        },
      ])
      .select("id, short_code, status")

    if (seedError || !seeded) {
      return NextResponse.json({ error: seedError?.message ?? "Demo orders could not be created" }, { status: 500 })
    }
    bookings = seeded
    created = seeded.length

    const bags = seeded.flatMap((booking) => [1, 2].map((bagNumber) => ({
      booking_id: booking.id,
      bag_number: bagNumber,
      label_code: `${booking.short_code ?? booking.id.slice(0, 6).toUpperCase()}-B${bagNumber}`,
      status: booking.status === "confirmed" ? "pending" : booking.status,
    })))
    const { error: bagError } = await supabase.from("order_bags").insert(bags)
    if (bagError) return NextResponse.json({ error: bagError.message }, { status: 500 })
  }

  const results = []

  for (const b of bookings) {
    const update: Record<string, string | null> = {
      pickup_date: today,
      assigned_driver_id: null, // ensure unassigned so they show in Unassigned column
    }
    // Delivery examples belong on today's delivery route.
    if (b.status === "out_for_delivery") {
      update.delivery_date = today
    }

    const { error: updateErr } = await supabase
      .from("bookings")
      .update(update)
      .eq("id", b.id)
      .eq("location_id", locationId)

    results.push({ short_code: b.short_code, status: b.status, ok: !updateErr, error: updateErr?.message })
  }

  return NextResponse.json({ today, created, updated: results.length, results })
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}
