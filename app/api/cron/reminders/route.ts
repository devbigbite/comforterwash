import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendSMS } from "@/lib/sms"
import { sendPickupReminderToCustomer } from "@/lib/email"
import { todayET } from "@/lib/date-et"
import { getBranding } from "@/lib/location"

// Vercel cron calls this route — secured by CRON_SECRET
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = todayET()
  const supabase = createAdminClient()

  // Fetch all pickups for today that are not yet picked up or cancelled —
  // across every tenant, since a cron request has no hostname to scope to
  // a single location. location_id is selected so branding can be resolved
  // per-booking below (a cron run must never assume "today's tenant" —
  // there isn't one).
  const { data: pickups, error } = await supabase
    .from("bookings")
    .select("id, customer_name, customer_phone, customer_email, pickup_time_window, service_type, customer_address, location_id")
    .eq("pickup_date", today)
    .not("status", "in", '("picked_up","in_progress","out_for_delivery","delivered","cancelled")')

  if (error) {
    console.error("[cron/reminders] DB error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!pickups || pickups.length === 0) {
    console.log(`[cron/reminders] No pickups for ${today}`)
    return NextResponse.json({ sent: 0, date: today })
  }

  let smsSent = 0
  let emailSent = 0
  const errors: string[] = []
  // Cache branding per location_id — a single cron run covers every tenant,
  // so each booking's own location must resolve its own business name
  // instead of one global getBranding() call (which would silently fall
  // back to Orlando for everyone, since a cron request has no hostname).
  const brandingCache = new Map<string, Awaited<ReturnType<typeof getBranding>>>()
  async function brandingFor(locationId: string | null) {
    const key = locationId ?? "__default__"
    if (!brandingCache.has(key)) {
      brandingCache.set(key, await getBranding(locationId ?? undefined))
    }
    return brandingCache.get(key)!
  }

  for (const booking of pickups) {
    const firstName = booking.customer_name?.split(" ")[0] ?? "there"
    const timeWindow = booking.pickup_time_window ?? "your scheduled time"
    const branding = await brandingFor(booking.location_id)

    // SMS reminder
    if (booking.customer_phone) {
      const msg = `Hi ${firstName}! Reminder: ${branding.business_name} will be picking up your laundry today between ${timeWindow}. Please have it ready! Questions? Reply to this message.`
      const smsResult = await sendSMS(booking.customer_phone, msg)
      if (smsResult.success) smsSent++
      else errors.push(`SMS ${booking.id}: ${smsResult.error}`)
    }

    // Email reminder
    if (booking.customer_email) {
      try {
        await sendPickupReminderToCustomer(booking.customer_email, {
          customerName:    booking.customer_name ?? "Valued Customer",
          pickupDate:      today,
          pickupTimeWindow: timeWindow,
          pickupAddress:   booking.customer_address ?? "",
          serviceType:     booking.service_type ?? "laundry",
        }, booking.location_id ?? undefined)
        emailSent++
      } catch (err) {
        errors.push(`Email ${booking.id}: ${String(err)}`)
      }
    }
  }

  console.log(`[cron/reminders] ${today}: ${smsSent} SMS, ${emailSent} emails sent. ${errors.length} errors.`)

  return NextResponse.json({
    date: today,
    total: pickups.length,
    smsSent,
    emailSent,
    errors: errors.length > 0 ? errors : undefined,
  })
}
