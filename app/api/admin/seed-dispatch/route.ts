import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function POST() {
  const supabase = createAdminClient()

  // Today in Eastern Time
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date())

  // Grab WF- sample orders that are confirmed or picked_up
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("id, short_code, status")
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

    results.push({ short_code: b.short_code, status: b.status, ok: !updateErr, error: updateErr?.message })
  }

  return NextResponse.json({ today, updated: results.length, results })
}

export async function GET() {
  return NextResponse.json({ info: "POST to this endpoint to set today's date on WF- sample orders for dispatch demo" })
}
