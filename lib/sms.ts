"use server"

import { createClient } from "@/lib/supabase/server"

// SMS notification templates
const SMS_TEMPLATES = {
  booking_confirmed: (name: string, pickupDate: string, pickupTime: string) =>
    `Hi ${name}! Your WashFold Orlando booking is confirmed. Pickup scheduled for ${pickupDate} between ${pickupTime}. We'll text you updates!`,

  pickup_reminder: (name: string, pickupTime: string) =>
    `Hi ${name}! Reminder: We'll be picking up your comforters today between ${pickupTime}. Please have them ready. Thanks!`,

  picked_up: (name: string, deliveryDate: string) =>
    `Hi ${name}! We've picked up your comforters. They're being cleaned and will be delivered on ${deliveryDate}. Track your order at washfoldorlando.com`,

  in_progress: (name: string) =>
    `Hi ${name}! Your comforters are being professionally cleaned. We'll notify you when they're ready for delivery!`,

  out_for_delivery: (name: string, deliveryTime: string) =>
    `Hi ${name}! Your fresh, clean comforters are out for delivery! Expect them between ${deliveryTime} today.`,

  delivered: (name: string) =>
    `Hi ${name}! Your comforters have been delivered. Enjoy your fresh, clean bedding! Thanks for choosing WashFold Orlando!`,
}

export async function sendSMS(phoneNumber: string, message: string) {
  // In production, integrate with Twilio or similar SMS service
  // For now, we'll log the SMS and store it in the database
  console.log(`[v0] SMS to ${phoneNumber}: ${message}`)

  // Simulate SMS sending
  // In production, use:
  // const twilio = require('twilio')(accountSid, authToken);
  // await twilio.messages.create({
  //   body: message,
  //   from: process.env.TWILIO_PHONE_NUMBER,
  //   to: phoneNumber
  // });

  return { success: true, message: "SMS sent successfully" }
}

export async function sendBookingNotification(
  bookingId: string,
  notificationType: keyof typeof SMS_TEMPLATES,
  ...templateArgs: string[]
) {
  const supabase = await createClient()

  // Get booking details
  const { data: booking, error } = await supabase.from("bookings").select("*").eq("id", bookingId).single()

  if (error || !booking) {
    console.error("[v0] Error fetching booking:", error)
    throw new Error("Booking not found")
  }

  // Generate message from template
  const message = SMS_TEMPLATES[notificationType](...(templateArgs as [string, ...string[]]))

  // Send SMS
  await sendSMS(booking.customer_phone, message)

  // Update booking with SMS notification record
  const smsRecord = {
    type: notificationType,
    message,
    sent_at: new Date().toISOString(),
  }

  const existingNotifications = (booking.sms_notifications_sent as Array<unknown>) || []

  await supabase
    .from("bookings")
    .update({
      last_sms_sent_at: new Date().toISOString(),
      sms_notifications_sent: [...existingNotifications, smsRecord],
    })
    .eq("id", bookingId)

  return { success: true }
}
