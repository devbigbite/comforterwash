// Daily cron (see vercel.json) — runs the demo-request follow-up email
// sequence. Vercel signs cron requests with the CRON_SECRET env var as a
// bearer token, so this route rejects anything that doesn't match to keep
// it from being triggered by an outside request.
import { NextRequest, NextResponse } from "next/server"
import { runDemoFollowUpSequence } from "@/app/actions/platform-demo-email"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await runDemoFollowUpSequence()
  return NextResponse.json(result)
}
