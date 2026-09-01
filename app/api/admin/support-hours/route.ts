import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { getLocationId } from "@/lib/location"
import { isAdminForCurrentLocation } from "@/lib/auth-guard"

// Renamed from "platform_hours" -- this was originally built as if it gated
// booking availability, but nothing in the booking flow ever read it. It's
// being repurposed as informational "Customer Service Hours" (live support
// availability, like office hours), so the storage key moved to
// "support_hours" to match. GET falls back to the old key so a tenant who
// already configured hours under the old concept doesn't lose that data on
// first load -- it gets rewritten under the new key on their next Save.
export async function POST(req: Request) {
  if (!(await isAdminForCurrentLocation())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const value = await req.json()
    const [supabase, locationId] = [createAdminClient(), await getLocationId()]
    await supabase.from("settings").upsert(
      {
        key: "support_hours",
        value: JSON.stringify(value),
        location_id: locationId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "location_id,key" }
    )
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}

export async function GET() {
  if (!(await isAdminForCurrentLocation())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const [supabase, locationId] = [createAdminClient(), await getLocationId()]
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "support_hours")
      .eq("location_id", locationId)
      .single()
    if (data?.value) return NextResponse.json(JSON.parse(data.value))

    // Migration fallback -- one-time read of the old key so previously
    // configured hours (saved back when this was "Platform Operating
    // Hours") aren't just lost. Old shape was the raw WeekHours object with
    // no "enabled" flag, so default enabled to false: nothing was ever
    // wired to enforce it live, so there's no prior "on" state to honor.
    const { data: legacy } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "platform_hours")
      .eq("location_id", locationId)
      .single()
    if (legacy?.value) {
      return NextResponse.json({ enabled: false, hours: JSON.parse(legacy.value) })
    }

    return NextResponse.json(null)
  } catch {
    return NextResponse.json(null)
  }
}
