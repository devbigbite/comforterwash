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

  // Grab WF- sample orders that are confirmed or picked_up
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("id, short_code, status")
    .eq("location_id", locationId)
    .like("short_code", "WF-%")
    .in("status", ["confirmed", "picked_up", "in_progress"])
    .order("short_code")

  if (!bookings?.length) return NextResponse.json({ error: "No WF- orders found", detail: error }, { status: 404 })

  const results = []

  for (const b of bookings) {
    const update: Record<string, string | null> = {
      pickup_date: today,
      assigned_driver_id: null, // ensure unassigned so they show in Unassigned column
    }
    // in_progress orders: set delivery date to today too
    if (b.status === "in_progress") {
      update.delivery_date = today
    }

    const { error: updateErr } = await supabase
      .from("bookings")
      .update(update)
      .eq("id", b.id)
      .eq("location_id", locationId)

    results.push({ short_code: b.short_code, status: b.status, ok: !updateErr, error: updateErr?.message })
  }

  return NextResponse.json({ today, updated: results.length, results })
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}
