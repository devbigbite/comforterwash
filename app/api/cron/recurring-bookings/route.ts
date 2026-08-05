import { NextRequest, NextResponse } from "next/server"
import { runRecurringEngine } from "@/app/actions/recurring-engine"

// Vercel cron calls this route — secured by CRON_SECRET, same pattern as the
// other cron routes (reminders, next-day-reminders, demo-follow-ups).
// Generates the next due booking for every active residential weekly/
// biweekly subscription and every active recurring commercial account —
// see app/actions/recurring-engine.ts for the actual logic.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await runRecurringEngine()
    console.log(
      `[cron/recurring-bookings] residential=${result.residentialCreated} commercial=${result.commercialCreated} errors=${result.errors.length}`
    )
    return NextResponse.json(result)
  } catch (err) {
    console.error("[cron/recurring-bookings] fatal:", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}
