import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Twilio inbound-message webhook. Point a Twilio Messaging Service's
// "A message comes in" webhook at this URL to get real STOP/UNSUBSCRIBE
// compliance for the marketing SMS features (campaigns, abandoned-cart
// recovery, re-engagement) -- without this, sms_opt_out can only ever be
// set manually from the admin Customers page. Twilio itself will also
// auto-block future sends to a number that's texted STOP to a toll-free/
// short code number under its own carrier-level filtering, but reflecting
// it into customers.sms_opt_out keeps the platform's own send lists honest
// and keeps a paper trail of who asked to be removed and when.
//
// Not wired into vercel.json (nothing to schedule -- it's called by Twilio,
// not cron) and not linked from the admin UI; the tenant/platform owner
// needs to configure the Twilio number's webhook to point here.
const STOP_KEYWORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"])

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const from = (form.get("From") as string | null)?.replace(/\D/g, "") ?? ""
  const body = ((form.get("Body") as string | null) ?? "").trim().toLowerCase()

  if (from && STOP_KEYWORDS.has(body)) {
    const supabase = createAdminClient()
    // Match on the last 10 digits so formatting differences (+1 prefix or
    // not) between what a customer typed at booking and what Twilio reports
    // as the sender don't cause a missed opt-out.
    const last10 = from.slice(-10)
    await supabase.from("customers").update({ sms_opt_out: true }).ilike("phone", `%${last10}`)
  }

  // Empty TwiML response — no auto-reply text (Twilio/carriers already send
  // their own STOP confirmation for numbers under standard compliance).
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
    headers: { "Content-Type": "text/xml" },
  })
}
