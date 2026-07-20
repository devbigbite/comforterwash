import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { getLocationId } from "@/lib/location"
import { isAdminForCurrentLocation } from "@/lib/auth-guard"

export async function POST(req: Request) {
  if (!(await isAdminForCurrentLocation())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const hours = await req.json()
    const [supabase, locationId] = [createAdminClient(), await getLocationId()]
    await supabase.from("settings").upsert(
      {
        key: "platform_hours",
        value: JSON.stringify(hours),
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
      .eq("key", "platform_hours")
      .eq("location_id", locationId)
      .single()
    return NextResponse.json(data?.value ? JSON.parse(data.value) : null)
  } catch {
    return NextResponse.json(null)
  }
}
