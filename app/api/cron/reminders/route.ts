import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendSMS } from "@/lib/sms"
import { sendPickupReminderToCustomer } from "@/lib/email"
import { todayET } from "@/lib/date-et"

// Vercel cron calls this route — secured by CRON_SECRET
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = todayET()
  const supabase = createAdminClient()

  // Fetch all pickups for today that are not yet picked up or cancelled
  const { data: pickups, error } = await supabase
    .from("bookings")
    .select("id, customer_name, customer_phone, customer_email, pickup_time_window, service_type, customer_address")
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

  for (const booking of pickups) {
    const firstName = booking.customer_name?.split(" ")[0] ?? "there"
    const timeWindow = booking.pickup_time_window ?? "your scheduled time"

    // SMS reminder
    if (booking.customer_phone) {
      const msg = `Hi ${firstName}! Reminder: WashFold Orlando will be picking up your laundry today between ${timeWindow}. Please have it ready! Questions? Reply to this message.`
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
        })
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
