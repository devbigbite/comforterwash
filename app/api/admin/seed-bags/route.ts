import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// Maps booking status → what bag status to create
const BOOKING_TO_BAG_STATUS: Record<string, string> = {
  confirmed:        "pending",
  picked_up:        "picked_up",
  in_progress:      "at_facility",
  out_for_delivery: "ready",
  delivered:        "delivered",
}

// For in_progress, spread bags across processing stages for realism
const IN_PROGRESS_STAGES = ["at_facility", "in_washer", "in_dryer", "folded"]

export async function POST() {
  const supabase = createAdminClient()

  // Get all WF- sample orders
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, short_code, status, service_type, num_bags, num_comforters")
    .like("short_code", "WF-%")
    .order("short_code")

  if (!bookings?.length) return NextResponse.json({ error: "No WF- orders found" }, { status: 404 })

  const results = []

  for (const booking of bookings) {
    // Check if bags already exist
    const { data: existing } = await supabase
      .from("order_bags")
      .select("id")
      .eq("booking_id", booking.id)

    if (existing && existing.length > 0) {
      results.push({ short_code: booking.short_code, skipped: true, reason: "already has bags" })
      continue
    }

    const bagCount = booking.num_bags || booking.num_comforters || 2
    const baseStatus = BOOKING_TO_BAG_STATUS[booking.status] ?? "pending"
    const isComforter = booking.service_type === "comforter_wash"
    const prefix = isComforter ? "CW" : "WF"

    const bags = Array.from({ length: bagCount }, (_, i) => {
      let bagStatus = baseStatus
      // For in_progress, spread bags across stages
      if (booking.status === "in_progress") {
        bagStatus = IN_PROGRESS_STAGES[i % IN_PROGRESS_STAGES.length]
      }

      return {
        booking_id: booking.id,
        bag_number: i + 1,
        label_code: `${prefix}-${booking.short_code?.replace("WF-", "")}-B${i + 1}`,
        status: bagStatus,
        scanned_at_facility: ["at_facility","in_washer","in_dryer","folded","ready","delivered"].includes(bagStatus)
          ? new Date().toISOString() : null,
      }
    })

    const { error } = await supabase.from("order_bags").insert(bags)
    if (error) {
      results.push({ short_code: booking.short_code, error: error.message })
    } else {
      results.push({ short_code: booking.short_code, created: bags.length, status: baseStatus })
    }
  }

  return NextResponse.json({ results })
}
