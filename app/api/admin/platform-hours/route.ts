import { createAdminClient } from "@/lib/supabase/admin"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

async function checkAdminCookie() {
  const cookieStore = await cookies()
  return cookieStore.get("admin_auth")?.value === "authenticated"
}

export async function POST(req: Request) {
  if (!(await checkAdminCookie())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const hours = await req.json()
    const supabase = createAdminClient()
    await supabase.from("settings").upsert({
      key: "platform_hours",
      value: JSON.stringify(hours),
      updated_at: new Date().toISOString(),
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  if (!(await checkAdminCookie())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "platform_hours")
      .single()
    return NextResponse.json(data?.value ? JSON.parse(data.value) : null)
  } catch {
    return NextResponse.json(null)
  }
}
