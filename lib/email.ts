"use server"

import { Resend } from "resend"
import {
  buildBookingConfirmationEmail,
  buildAdminNewOrderEmail,
  buildPickupReminderEmail,
  buildOrderPickedUpEmail,
  buildOutForDeliveryEmail,
  buildDeliveredEmail,
  type BookingConfirmationData,
  type AdminNewOrderData,
  type PickupReminderData,
  type OrderPickedUpData,
  type OutForDeliveryData,
  type DeliveredData,
} from "./email-templates"

// ─────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY ?? "re_missing_configure_in_vercel")

const FROM_CUSTOMER = "WashFold Orlando <hello@washfoldorlando.com>"
const FROM_ADMIN    = "WashFold Orlando <bookings@washfoldorlando.com>"
const ADMIN_EMAIL   = process.env.ADMIN_EMAIL ?? "jbtanon@gmail.com"

// ─────────────────────────────────────────────────────────────────
// Generic send helper (swallows errors so they don't break payments)
// ─────────────────────────────────────────────────────────────────
async function safeSend(payload: Parameters<typeof resend.emails.send>[0]) {
  try {
    const result = await resend.emails.send(payload)
    if (result.error) {
      console.error("[email] Resend error:", result.error)
    }
    return result
  } catch (err) {
    console.error("[email] Failed to send email:", err)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────
// 1. Customer: Booking Confirmation
// ─────────────────────────────────────────────────────────────────
export async function sendBookingConfirmationEmail(data: BookingConfirmationData) {
  const { subject, html } = buildBookingConfirmationEmail(data)
  return safeSend({
    from: FROM_CUSTOMER,
    to: [data.customerEmail],
    subject,
    html,
  })
}

// ─────────────────────────────────────────────────────────────────
// 2. Admin: New Order Alert
// ─────────────────────────────────────────────────────────────────
export async function sendAdminNewOrderEmail(data: AdminNewOrderData) {
  const { subject, html } = buildAdminNewOrderEmail(data)
  return safeSend({
    from: FROM_ADMIN,
    to: [ADMIN_EMAIL],
    subject,
    html,
  })
}

// ─────────────────────────────────────────────────────────────────
// 3. Customer: Pickup Reminder
// ─────────────────────────────────────────────────────────────────
export async function sendPickupReminderEmail(data: PickupReminderData) {
  const { subject, html } = buildPickupReminderEmail(data)
  // We need the customer's email — caller must supply it alongside PickupReminderData
  // So we accept an extra `toEmail` param here
  return { subject, html }  // returned so caller can add `to` — see sendPickupReminderToCustomer
}

export async function sendPickupReminderToCustomer(toEmail: string, data: PickupReminderData) {
  const { subject, html } = buildPickupReminderEmail(data)
  return safeSend({
    from: FROM_CUSTOMER,
    to: [toEmail],
    subject,
    html,
  })
}

// ─────────────────────────────────────────────────────────────────
// 4. Customer: Order Picked Up
// ─────────────────────────────────────────────────────────────────
export async function sendOrderPickedUpEmail(toEmail: string, data: OrderPickedUpData) {
  const { subject, html } = buildOrderPickedUpEmail(data)
  return safeSend({
    from: FROM_CUSTOMER,
    to: [toEmail],
    subject,
    html,
  })
}

// ─────────────────────────────────────────────────────────────────
// 5. Customer: Out for Delivery
// ─────────────────────────────────────────────────────────────────
export async function sendOutForDeliveryEmail(toEmail: string, data: OutForDeliveryData) {
  const { subject, html } = buildOutForDeliveryEmail(data)
  return safeSend({
    from: FROM_CUSTOMER,
    to: [toEmail],
    subject,
    html,
  })
}

// ─────────────────────────────────────────────────────────────────
// 6. Customer: Delivered
// ─────────────────────────────────────────────────────────────────
export async function sendDeliveredEmail(toEmail: string, data: DeliveredData) {
  const { subject, html } = buildDeliveredEmail(data)
  return safeSend({
    from: FROM_CUSTOMER,
    to: [toEmail],
    subject,
    html,
  })
}
