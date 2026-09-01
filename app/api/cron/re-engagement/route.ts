import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendSMS } from "@/lib/sms"
import { getMarketingSettings } from "@/app/actions/marketing-settings"

// Vercel cron — secured by CRON_SECRET. Runs daily across every tenant;
// each location's own re-engagement settings (on/off, dormant threshold,
// re-send interval) are looked up per-location. Capped per run so one
// large tenant with a big dormant list can't starve everyone else's window
// or blow through Twilio's rate limits in a single invocation.
const MAX_PER_LOCATION_PER_RUN = 200

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: locations } = await supabase.from("locations").select("id")
  if (!locations?.length) return NextResponse.json({ sent: 0 })

  let totalSent = 0
  const errors: string[] = []

  for (const loc of locations) {
    const settings = await getMarketingSettings(loc.id)
    if (!settings.reengagementEnabled) continue

    const now = Date.now()
    const dormantCutoff = new Date(now - settings.reengagementDormantDays * 86_400_000).toISOString()
    const resendCutoff = new Date(now - settings.reengagementIntervalDays * 86_400_000).toISOString()

    const { data: customers } = await supabase
      .from("customers")
      .select("id, name, phone, sms_opt_out, last_booking_at, last_reengagement_sent_at")
      .eq("location_id", loc.id)
      .not("phone", "is", null)
      .eq("sms_opt_out", false)
      .lte("last_booking_at", dormantCutoff)
      .or(`last_reengagement_sent_at.is.null,last_reengagement_sent_at.lte.${resendCutoff}`)
      .limit(MAX_PER_LOCATION_PER_RUN)

    for (const customer of customers ?? []) {
      const firstName = customer.name?.split(" ")[0] ?? "there"
      const message = settings.reengagementMessage.replace(/\{name\}/g, firstName)

      const result = await sendSMS(customer.phone as string, message)
      await supabase.from("customers").update({ last_reengagement_sent_at: new Date().toISOString() }).eq("id", customer.id)

      if (result.success) totalSent++
      else errors.push(`${customer.id}: ${result.error}`)
    }
  }

  return NextResponse.json({ sent: totalSent, errors: errors.slice(0, 10) })
}
