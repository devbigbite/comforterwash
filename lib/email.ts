"use server"

import { Resend } from "resend"
import {
  buildBookingConfirmationEmail,
  buildAdminNewOrderEmail,
  buildPickupReminderEmail,
  buildOrderPickedUpEmail,
  buildOutForDeliveryEmail,
  buildDeliveredEmail,
  buildAccountReadyEmail,
  type BookingConfirmationData,
  type AdminNewOrderData,
  type PickupReminderData,
  type OrderPickedUpData,
  type OutForDeliveryData,
  type DeliveredData,
} from "./email-templates"
import { getEmailTemplate } from "@/app/actions/email-templates"

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
  const ov = await getEmailTemplate("customer_booking_confirmation")
  const { subject, html } = buildBookingConfirmationEmail(data, ov ?? {})
  return safeSend({ from: FROM_CUSTOMER, to: [data.customerEmail], subject, html })
}

// ─────────────────────────────────────────────────────────────────
// 2. Admin: New Order Alert
// ─────────────────────────────────────────────────────────────────
export async function sendAdminNewOrderEmail(data: AdminNewOrderData) {
  const ov = await getEmailTemplate("admin_new_order")
  const { subject, html } = buildAdminNewOrderEmail(data, ov ?? {})
  return safeSend({ from: FROM_ADMIN, to: [ADMIN_EMAIL], subject, html })
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
  const ov = await getEmailTemplate("pickup_reminder")
  const { subject, html } = buildPickupReminderEmail(data, ov ?? {})
  return safeSend({ from: FROM_CUSTOMER, to: [toEmail], subject, html })
}

// ─────────────────────────────────────────────────────────────────
// 4. Customer: Order Picked Up
// ─────────────────────────────────────────────────────────────────
export async function sendOrderPickedUpEmail(toEmail: string, data: OrderPickedUpData) {
  const ov = await getEmailTemplate("order_picked_up")
  const { subject, html } = buildOrderPickedUpEmail(data, ov ?? {})
  return safeSend({ from: FROM_CUSTOMER, to: [toEmail], subject, html })
}

// ─────────────────────────────────────────────────────────────────
// 5. Customer: Out for Delivery
// ─────────────────────────────────────────────────────────────────
export async function sendOutForDeliveryEmail(toEmail: string, data: OutForDeliveryData) {
  const ov = await getEmailTemplate("out_for_delivery")
  const { subject, html } = buildOutForDeliveryEmail(data, ov ?? {})
  return safeSend({ from: FROM_CUSTOMER, to: [toEmail], subject, html })
}

// ─────────────────────────────────────────────────────────────────
// 6. Customer: Delivered
// ─────────────────────────────────────────────────────────────────
export async function sendDeliveredEmail(toEmail: string, data: DeliveredData) {
  const ov = await getEmailTemplate("delivered")
  const { subject, html } = buildDeliveredEmail(data, ov ?? {})
  return safeSend({ from: FROM_CUSTOMER, to: [toEmail], subject, html })
}

// ─────────────────────────────────────────────────────────────────
// 7. Admin: Schedule Anomaly Alert  (Level 3 — enabled via SCHEDULE_ALERT_EMAIL_ENABLED)
// ─────────────────────────────────────────────────────────────────
export interface ScheduleAlertData {
  workerName: string
  role: string
  flag: "unscheduled" | "early_in" | "late_in" | "early_out" | "late_out"
  flagMinutes: number
  clockTime: string    // formatted local time string
  scheduledTime: string | null  // null when unscheduled
}

export async function sendScheduleAlertEmail(to: string, data: ScheduleAlertData) {
  const flagLabels: Record<string, string> = {
    unscheduled: "clocked in with no shift scheduled",
    early_in:    `clocked in ${data.flagMinutes} min early`,
    late_in:     `clocked in ${data.flagMinutes} min late`,
    early_out:   `clocked out ${data.flagMinutes} min early`,
    late_out:    `clocked out ${data.flagMinutes} min late`,
  }
  const description = flagLabels[data.flag] ?? data.flag
  const subject = `⚠️ Schedule alert — ${data.workerName} ${description}`
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#0D2240;margin-bottom:4px">Schedule Alert</h2>
      <p style="color:#666;font-size:14px;margin-bottom:24px">WashFold Orlando · Staff Clock</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px 0;color:#888;width:140px">Worker</td><td style="font-weight:600;color:#0D2240">${data.workerName}</td></tr>
        <tr><td style="padding:8px 0;color:#888">Role</td><td style="color:#0D2240">${data.role}</td></tr>
        <tr><td style="padding:8px 0;color:#888">Alert</td><td style="color:#E8726A;font-weight:700;text-transform:capitalize">${description}</td></tr>
        <tr><td style="padding:8px 0;color:#888">Clock time</td><td style="color:#0D2240">${data.clockTime}</td></tr>
        ${data.scheduledTime ? `<tr><td style="padding:8px 0;color:#888">Scheduled</td><td style="color:#0D2240">${data.scheduledTime}</td></tr>` : ""}
      </table>
      <p style="margin-top:24px;font-size:12px;color:#aaa">Review attendance at /admin/schedule</p>
    </div>
  `
  return safeSend({ from: FROM_ADMIN, to: [to], subject, html })
}

// ─────────────────────────────────────────────────────────────────
// 8. Customer: Account Ready (new account created post-booking)
// ─────────────────────────────────────────────────────────────────
export async function sendAccountReadyEmail(
  toEmail: string,
  customerName: string,
  magicLink: string,
  isRecurring: boolean,
) {
  const { subject, html } = buildAccountReadyEmail({ customerName, magicLink, isRecurring })
  return safeSend({ from: FROM_CUSTOMER, to: [toEmail], subject, html })
}
