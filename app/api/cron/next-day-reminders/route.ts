import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendSMS } from "@/lib/sms"
import { sendPickupReminderToCustomer } from "@/lib/email"
import { todayET } from "@/lib/date-et"
import { getBranding } from "@/lib/location"

const SERVICE_LABEL: Record<string, string> = {
  comforter_wash: "comforter wash",
  wash_fold:      "wash/fold",
  wash_only:      "wash only",
}

function tomorrowET(): string {
  // todayET() gives "YYYY-MM-DD" in America/New_York — add a day the same
  // way the rest of the app does (construct at noon to dodge DST edge cases).
  const d = new Date(todayET() + "T12:00:00")
  d.setDate(d.getDate() + 1)
  return d.toISOString().split("T")[0]
}

/** Same as tomorrowET() but for an arbitrary IANA timezone — used to compute
 *  each tenant's own "tomorrow" below, not just Orlando's. */
function tomorrowFor(tz: string): string {
  const d = new Date(todayET(tz) + "T12:00:00")
  d.setDate(d.getDate() + 1)
  return d.toISOString().split("T")[0]
}

/** YYYY-MM-DD for a UTC instant, offset by `days`. Used only to build a wide
 *  enough net of candidate pickup_dates to cover "tomorrow" in ANY tenant's
 *  timezone before we narrow down per-tenant below — this is intentionally
 *  timezone-naive (UTC), not a substitute for the per-tenant check. */
function utcDateOffset(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split("T")[0]
}

// Vercel cron calls this route — secured by CRON_SECRET. Runs the evening
// before pickup (see vercel.json), a separate heads-up from
// /api/cron/reminders which fires the morning of pickup itself.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // "Tomorrow" is tenant-specific — a tenant outside Eastern time can have
  // a different calendar date for "tomorrow evening" than Orlando does at
  // the moment this cron fires. We used to filter the query to a single
  // Eastern-derived `tomorrow` for every tenant, which meant a non-Eastern
  // tenant's reminder could fire a day early/late relative to their own
  // pickup date. Fix: pull a wide UTC-based net of candidate dates first,
  // then resolve+check each booking's OWN tenant timezone below before
  // deciding whether it's actually "tomorrow" for that tenant.
  const tomorrow = tomorrowET() // kept for the response payload / logging (Orlando's "tomorrow")
  const candidateDates = [utcDateOffset(-1), utcDateOffset(0), utcDateOffset(1), utcDateOffset(2)]
  const supabase = createAdminClient()

  // Same tenant-agnostic query pattern as /api/cron/reminders — a cron
  // request has no hostname, so this covers every tenant's pickups in the
  // candidate window and resolves each booking's own branding/timezone below.
  const { data: pickupsWide, error } = await supabase
    .from("bookings")
    .select("id, customer_name, customer_phone, customer_email, pickup_time_window, service_type, customer_address, location_id, pickup_date")
    .in("pickup_date", candidateDates)
    .not("status", "in", '("picked_up","in_progress","out_for_delivery","delivered","cancelled")')

  if (error) {
    console.error("[cron/next-day-reminders] DB error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!pickupsWide || pickupsWide.length === 0) {
    console.log(`[cron/next-day-reminders] No candidate pickups in window ${candidateDates.join(",")}`)
    return NextResponse.json({ sent: 0, date: tomorrow })
  }

  let smsSent = 0
  let emailSent = 0
  const errors: string[] = []
  const brandingCache = new Map<string, Awaited<ReturnType<typeof getBranding>>>()
  async function brandingFor(locationId: string | null) {
    const key = locationId ?? "__default__"
    if (!brandingCache.has(key)) {
      brandingCache.set(key, await getBranding(locationId ?? undefined))
    }
    return brandingCache.get(key)!
  }

  let pickups: typeof pickupsWide = []
  for (const booking of pickupsWide) {
    const branding = await brandingFor(booking.location_id)
    // Only send if booking.pickup_date is actually "tomorrow" in THIS
    // booking's own tenant timezone — the candidate window above is
    // deliberately wide (UTC ±1/2 days) to make sure every tenant's real
    // "tomorrow" is included in it, so this check is what does the real
    // narrowing, not the DB query.
    if (booking.pickup_date === tomorrowFor(branding.timezone)) {
      pickups.push(booking)
    }
  }

  if (pickups.length === 0) {
    console.log(`[cron/next-day-reminders] No pickups are "tomorrow" for any tenant in this run (candidates: ${candidateDates.join(",")})`)
    return NextResponse.json({ sent: 0, date: tomorrow })
  }

  for (const booking of pickups) {
    const firstName = booking.customer_name?.split(" ")[0] ?? "there"
    const timeWindow = booking.pickup_time_window ?? "your scheduled time"
    const serviceLabel = SERVICE_LABEL[booking.service_type ?? ""] ?? "laundry"
    const branding = await brandingFor(booking.location_id)

    // SMS: "Hi {name}! Reminder: {business} will be picking up your
    // {wash/fold} tomorrow between {window}."
    if (booking.customer_phone) {
      const msg = `Hi ${firstName}! Reminder: ${branding.business_name} will be picking up your ${serviceLabel} tomorrow between ${timeWindow}.`
      const smsResult = await sendSMS(booking.customer_phone, msg)
      if (smsResult.success) smsSent++
      else errors.push(`SMS ${booking.id}: ${smsResult.error}`)
    }

    // Email — same template as the same-day reminder, with when: "tomorrow"
    // swapping the wording so it doesn't say "today" a day early.
    if (booking.customer_email) {
      try {
        await sendPickupReminderToCustomer(booking.customer_email, {
          customerName:     booking.customer_name ?? "Valued Customer",
          pickupDate:       booking.pickup_date,
          pickupTimeWindow: timeWindow,
          pickupAddress:    booking.customer_address ?? "",
          serviceType:      booking.service_type ?? "laundry",
          when:             "tomorrow",
        }, booking.location_id ?? undefined)
        emailSent++
      } catch (err) {
        errors.push(`Email ${booking.id}: ${String(err)}`)
      }
    }
  }

  console.log(`[cron/next-day-reminders] ${tomorrow}: ${smsSent} SMS, ${emailSent} emails sent. ${errors.length} errors.`)

  return NextResponse.json({
    date: tomorrow,
    total: pickups.length,
    smsSent,
    emailSent,
    errors: errors.length > 0 ? errors : undefined,
  })
}
