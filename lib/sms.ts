"use server"

import { createAdminClient } from "@/lib/supabase/admin"

// ── SMS templates ────────────────────────────────────────────────────────────

const SMS_TEMPLATES = {
  booking_confirmed: (name: string, pickupDate: string, pickupTime: string) =>
    `Hi ${name}! Your WashFold Orlando booking is confirmed. Pickup scheduled for ${pickupDate} between ${pickupTime}.`,

  pickup_reminder: (name: string, pickupTime: string) =>
    `Hi ${name}! Reminder: We'll be picking up your laundry today between ${pickupTime}. Just leave it by your door. See you soon!`,

  picked_up: (name: string, deliveryDate: string) =>
    `Hi ${name}! We've picked up your laundry. Estimated delivery: ${deliveryDate}. - WashFold Orlando`,

  // Not used in the current flow — kept for manual use if needed
  in_progress: (name: string) =>
    `Hi ${name}! Your laundry is being processed. We'll notify you when it's ready for delivery!`,

  out_for_delivery: (name: string, deliveryTime: string) =>
    `Hi ${name}! Your fresh, clean laundry is out for delivery! Expect it between ${deliveryTime} today.`,

  delivered: (name: string) =>
    `Hi ${name}! Your laundry has been delivered! Thanks for choosing WashFold Orlando 🧺`,
}

// ── Core send function — Twilio REST API via fetch ───────────────────────────

export async function sendSMS(phoneNumber: string, message: string): Promise<{ success: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    console.error("[SMS] Missing Twilio env vars (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)")
    return { success: false, error: "Twilio not configured" }
  }

  // Normalize phone — ensure E.164 format (+1XXXXXXXXXX)
  const to = phoneNumber.replace(/\D/g, "")
  const toE164 = to.startsWith("1") ? `+${to}` : `+1${to}`
  const fromE164 = fromNumber.replace(/\D/g, "")
  const fromFormatted = fromE164.startsWith("1") ? `+${fromE164}` : `+1${fromE164}`

  const body = new URLSearchParams({
    To:   toE164,
    From: fromFormatted,
    Body: message,
  })

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method:  "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      }
    )

    const json = await res.json() as { sid?: string; status?: string; error_message?: string; message?: string }

    if (!res.ok) {
      console.error("[SMS] Twilio error:", json.error_message ?? json.message)
      return { success: false, error: json.error_message ?? json.message ?? "Twilio error" }
    }

    console.log(`[SMS] Sent to ${toE164} — SID: ${json.sid} status: ${json.status}`)
    return { success: true }
  } catch (err) {
    console.error("[SMS] Network error:", err)
    return { success: false, error: String(err) }
  }
}

// ── Higher-level helper used by server actions ───────────────────────────────

export async function sendBookingNotification(
  bookingId: string,
  notificationType: keyof typeof SMS_TEMPLATES,
  ...templateArgs: string[]
) {
  const supabase = createAdminClient()

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single()

  if (error || !booking) {
    console.error("[SMS] Booking not found:", bookingId)
    throw new Error("Booking not found")
  }

  const message = SMS_TEMPLATES[notificationType](...(templateArgs as [string, ...string[]]))
  const result  = await sendSMS(booking.customer_phone, message)

  if (result.success) {
    const smsRecord = { type: notificationType, message, sent_at: new Date().toISOString() }
    const existing  = (booking.sms_notifications_sent as Array<unknown>) || []
    await supabase
      .from("bookings")
      .update({
        last_sms_sent_at: new Date().toISOString(),
        sms_notifications_sent: [...existing, smsRecord],
      })
      .eq("id", bookingId)
  }

  return result
}
