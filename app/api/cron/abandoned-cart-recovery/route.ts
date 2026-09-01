import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendSMS } from "@/lib/sms"
import { getMarketingSettings } from "@/app/actions/marketing-settings"

// Vercel cron — secured by CRON_SECRET, same pattern as the other cron routes.
// Runs across every tenant (a cron request has no hostname to scope to one
// location), so each location's own abandoned-cart settings are looked up
// per-location rather than assumed.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: locations } = await supabase.from("locations").select("id")
  if (!locations?.length) return NextResponse.json({ sent: 0 })

  let totalSent = 0
  let totalSkipped = 0
  const errors: string[] = []

  for (const loc of locations) {
    const settings = await getMarketingSettings(loc.id)
    if (!settings.abandonedCartEnabled) continue

    const now = Date.now()
    // Window: attempts old enough to have passed the configured delay, but
    // not so old (delay + 24h) that a follow-up text is no longer useful --
    // otherwise every run would keep re-scanning the same ancient rows.
    const windowStart = new Date(now - (settings.abandonedCartDelayHours + 24) * 3_600_000).toISOString()
    const windowEnd = new Date(now - settings.abandonedCartDelayHours * 3_600_000).toISOString()

    const { data: attempts } = await supabase
      .from("checkout_attempts")
      .select("id, customer_name, customer_phone, created_at")
      .eq("location_id", loc.id)
      .in("status", ["pending", "failed", "expired"])
      .is("recovery_sms_sent_at", null)
      .not("customer_phone", "is", null)
      .gte("created_at", windowStart)
      .lte("created_at", windowEnd)
      .limit(100)

    for (const attempt of attempts ?? []) {
      const firstName = attempt.customer_name?.split(" ")[0] ?? "there"
      const message = settings.abandonedCartMessage
        .replace(/\{name\}/g, firstName)
        .replace(/\{code\}/g, settings.abandonedCartPromoCode || "")

      const result = await sendSMS(attempt.customer_phone as string, message)
      await supabase.from("checkout_attempts").update({ recovery_sms_sent_at: new Date().toISOString() }).eq("id", attempt.id)

      if (result.success) totalSent++
      else { totalSkipped++; errors.push(`${attempt.id}: ${result.error}`) }
    }
  }

  return NextResponse.json({ sent: totalSent, skipped: totalSkipped, errors: errors.slice(0, 10) })
}
