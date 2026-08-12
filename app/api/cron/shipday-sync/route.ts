import { NextRequest, NextResponse } from "next/server"
import { pollShipdayDeliveries } from "@/lib/shipday-sync"

// Vercel cron calls this route — secured by CRON_SECRET, same pattern as
// every other cron route in this codebase. See lib/shipday-sync.ts for why
// this exists: the Shipday webhook is the intended real-time path, but it's
// been confirmed unreliable (a real driver-app delivery completion never
// reached our webhook endpoint), so this polls as a safety net every few
// minutes and catches anything the webhook missed.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await pollShipdayDeliveries()
  console.log(`[cron/shipday-sync] checked=${result.checked} reconciled=${result.reconciled} errors=${result.errors.length}`)

  return NextResponse.json(result)
}
