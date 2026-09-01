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
  buildOrderIssueEmail,
  type BookingConfirmationData,
  type AdminNewOrderData,
  type PickupReminderData,
  type OrderPickedUpData,
  type OutForDeliveryData,
  type DeliveredData,
  type OrderIssueData,
} from "./email-templates"
import { getEmailTemplate } from "@/app/actions/email-templates"
import { getBranding, getLocationId, getLocationTimezone, ORLANDO_LOCATION_ID } from "@/lib/location"
import { createAdminClient } from "@/lib/supabase/admin"
import type { EmailBranding } from "./email-templates"

// ─────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY ?? "re_missing_configure_in_vercel")

// Fallback sending address for any tenant that hasn't verified their own
// domain yet (see /admin/branding → Custom Sending Domain). Once a tenant's
// domain is verified with Resend, getSendingAddress() below uses their own
// address instead — only the display name changed for everyone before that.
const SEND_DOMAIN = "clean@washfoldorlando.com"
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "jbtanon@gmail.com"

// Who receives operational alerts (new order, abandoned checkout, date
// conflict) for a given tenant.
//
// These used to go to ADMIN_EMAIL unconditionally, which meant the platform
// owner received every tenant's order alerts and the tenant themselves
// received none — a new SaaS customer could take an order and never be told.
// Now they go to the tenant's own support_email when they've set one.
//
// Orlando is deliberately special-cased to keep ADMIN_EMAIL on the list: it is
// the platform owner's own business, and silently rerouting their existing
// alerts to a different inbox would be a surprise, not a fix.
async function adminAlertRecipients(overrideLocationId?: string): Promise<string[]> {
  try {
    const locationId = overrideLocationId ?? (await getLocationId())
    const supabase = createAdminClient()
    const { data } = await supabase
      .from("locations")
      .select("support_email")
      .eq("id", locationId)
      .single()

    const tenantEmail = data?.support_email?.trim()
    if (!tenantEmail) return [ADMIN_EMAIL]
    if (locationId === ORLANDO_LOCATION_ID && tenantEmail !== ADMIN_EMAIL) {
      return [tenantEmail, ADMIN_EMAIL]
    }
    return [tenantEmail]
  } catch (err) {
    // An alert with a wrong recipient still beats an alert that never sends.
    console.error("[email] adminAlertRecipients failed, falling back:", err)
    return [ADMIN_EMAIL]
  }
}

async function getEmailBranding(overrideLocationId?: string): Promise<EmailBranding> {
  const [b, locationId] = await Promise.all([
    getBranding(overrideLocationId),
    overrideLocationId ? Promise.resolve(overrideLocationId) : getLocationId(),
  ])
  return {
    businessName: b.business_name,
    primaryColor: b.primary_color,
    accentColor: b.accent_color,
    supportPhone: b.support_phone ?? "(407) 123-4567",
    // Support is email-only at this stage — no phone/text line is shown to
    // customers yet, so this always resolves to the shared support inbox
    // rather than a per-tenant column (there isn't one yet).
    supportEmail: SEND_DOMAIN,
    // The tenant's own domain (custom domain, or slug.<platform domain>) --
    // was hardcoded to "washfoldorlando.com" for every tenant, which meant
    // "Book again" / "Track your order" links in every other tenant's
    // emails pointed at Orlando's site instead of their own.
    websiteDomain: b.website_domain,
    // Grandfathered: Orlando's own Google Business review link. No other
    // tenant has one on file yet (there's no settings field to collect it),
    // so no other tenant's delivered-email shows a review button rather
    // than misdirecting customers to Orlando's listing.
    googleReviewUrl: locationId === ORLANDO_LOCATION_ID ? "https://g.page/r/washfoldorlando/review" : null,
  }
}

// Resolves the actual "from" address to send as — the tenant's own verified
// domain if they've set one up and Resend has confirmed it, otherwise the
// shared fallback address (display name is always tenant-specific either way).
async function getSendingAddress(overrideLocationId?: string): Promise<string> {
  const locationId = overrideLocationId ?? (await getLocationId())
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("locations")
    .select("sending_domain, sending_domain_status, sending_email_local_part")
    .eq("id", locationId)
    .single()

  if (data?.sending_domain && data.sending_domain_status === "verified") {
    return `${data.sending_email_local_part || "hello"}@${data.sending_domain}`
  }
  return SEND_DOMAIN
}

async function fromCustomer(overrideLocationId?: string): Promise<string> {
  const [b, address] = await Promise.all([getEmailBranding(overrideLocationId), getSendingAddress(overrideLocationId)])
  return `${b.businessName} <${address}>`
}

async function fromAdmin(overrideLocationId?: string): Promise<string> {
  const [b, address] = await Promise.all([getEmailBranding(overrideLocationId), getSendingAddress(overrideLocationId)])
  return `${b.businessName} <${address}>`
}

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
  const [ov, branding, timezone] = await Promise.all([getEmailTemplate("customer_booking_confirmation"), getEmailBranding(), getLocationTimezone()])
  const { subject, html } = buildBookingConfirmationEmail({ ...data, timezone: data.timezone ?? timezone }, ov ?? {}, branding)
  return safeSend({ from: await fromCustomer(), to: [data.customerEmail], subject, html })
}

// ─────────────────────────────────────────────────────────────────
// 1b. Customer: Order Issue / Note (manual, staff-reviewed — see
// app/actions/order-issue-notes.ts)
// ─────────────────────────────────────────────────────────────────
export async function sendOrderIssueEmail(data: OrderIssueData) {
  const branding = await getEmailBranding()
  const { subject, html } = buildOrderIssueEmail(data, branding)
  return safeSend({ from: await fromCustomer(), to: [data.customerEmail], subject, html })
}

// ─────────────────────────────────────────────────────────────────
// 2. Admin: New Order Alert
// ─────────────────────────────────────────────────────────────────
export async function sendAdminNewOrderEmail(data: AdminNewOrderData) {
  const [ov, branding] = await Promise.all([getEmailTemplate("admin_new_order"), getEmailBranding()])
  const { subject, html } = buildAdminNewOrderEmail(data, ov ?? {}, branding)
  return safeSend({ from: await fromAdmin(), to: await adminAlertRecipients(), subject, html })
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

export async function sendPickupReminderToCustomer(toEmail: string, data: PickupReminderData, locationId?: string) {
  const [ov, branding, timezone] = await Promise.all([getEmailTemplate("pickup_reminder"), getEmailBranding(locationId), getLocationTimezone(locationId)])
  const { subject, html } = buildPickupReminderEmail({ ...data, timezone: data.timezone ?? timezone }, ov ?? {}, branding)
  return safeSend({ from: await fromCustomer(locationId), to: [toEmail], subject, html })
}

// ─────────────────────────────────────────────────────────────────
// 4. Customer: Order Picked Up
// ─────────────────────────────────────────────────────────────────
export async function sendOrderPickedUpEmail(toEmail: string, data: OrderPickedUpData) {
  const [ov, branding] = await Promise.all([getEmailTemplate("order_picked_up"), getEmailBranding()])
  const { subject, html } = buildOrderPickedUpEmail(data, ov ?? {}, branding)
  return safeSend({ from: await fromCustomer(), to: [toEmail], subject, html })
}

// ─────────────────────────────────────────────────────────────────
// 4b. Customer: Weight & Billing Confirmed
// ─────────────────────────────────────────────────────────────────
// Sent right after a driver/operator/admin enters the scale weight. Until
// this existed, a customer had no idea their order had even been weighed.
// Deliberately no pricing here per explicit request — just a warm
// thank-you + the weight, matching the SMS version's tone. Kept as a
// standalone inline template (not routed through the email-templates.ts
// customizable-override system like the others above) since it's a short
// courtesy note, not marketing copy a tenant would want to restyle.
export interface WeightConfirmedData {
  customerName: string
  shortCode: string | null
  weightLbs: number
}
export async function sendWeightConfirmedEmail(toEmail: string, data: WeightConfirmedData) {
  const branding = await getEmailBranding()
  const orderLabel = data.shortCode ? `Order ${data.shortCode}` : "Your order"
  const trackUrl = `https://${branding.websiteDomain}/track/${data.shortCode ?? ""}`
  const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:${branding.primaryColor};margin:0 0 12px">Thanks for trusting us with your laundry, ${data.customerName.split(" ")[0]}! 🧺</h2>
      <p style="color:#333;font-size:15px;line-height:1.5">${orderLabel} weighed in at <strong>${data.weightLbs} lbs</strong>. Thank you for choosing ${branding.businessName}!</p>
      <a href="${trackUrl}" style="display:inline-block;margin-top:12px;color:${branding.accentColor};font-weight:600;text-decoration:none">Track your order →</a>
      <p style="color:#aaa;font-size:12px;margin-top:24px">${branding.businessName} · ${branding.supportPhone}</p>
    </div>`
  return safeSend({
    from: await fromCustomer(),
    to: [toEmail],
    subject: `Thanks! ${orderLabel} weighed in at ${data.weightLbs} lbs`,
    html,
  })
}

// ─────────────────────────────────────────────────────────────────
// 5. Customer: Out for Delivery
// ─────────────────────────────────────────────────────────────────
export async function sendOutForDeliveryEmail(toEmail: string, data: OutForDeliveryData) {
  const [ov, branding] = await Promise.all([getEmailTemplate("out_for_delivery"), getEmailBranding()])
  const { subject, html } = buildOutForDeliveryEmail(data, ov ?? {}, branding)
  return safeSend({ from: await fromCustomer(), to: [toEmail], subject, html })
}

// ─────────────────────────────────────────────────────────────────
// 6. Customer: Delivered
// ─────────────────────────────────────────────────────────────────
export async function sendDeliveredEmail(toEmail: string, data: DeliveredData) {
  const [ov, branding] = await Promise.all([getEmailTemplate("delivered"), getEmailBranding()])
  const { subject, html } = buildDeliveredEmail(data, ov ?? {}, branding)
  return safeSend({ from: await fromCustomer(), to: [toEmail], subject, html })
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
  const branding = await getEmailBranding()
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
      <h2 style="color:${branding.primaryColor};margin-bottom:4px">Schedule Alert</h2>
      <p style="color:#666;font-size:14px;margin-bottom:24px">${branding.businessName} · Staff Clock</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px 0;color:#888;width:140px">Worker</td><td style="font-weight:600;color:${branding.primaryColor}">${data.workerName}</td></tr>
        <tr><td style="padding:8px 0;color:#888">Role</td><td style="color:${branding.primaryColor}">${data.role}</td></tr>
        <tr><td style="padding:8px 0;color:#888">Alert</td><td style="color:${branding.accentColor};font-weight:700;text-transform:capitalize">${description}</td></tr>
        <tr><td style="padding:8px 0;color:#888">Clock time</td><td style="color:${branding.primaryColor}">${data.clockTime}</td></tr>
        ${data.scheduledTime ? `<tr><td style="padding:8px 0;color:#888">Scheduled</td><td style="color:${branding.primaryColor}">${data.scheduledTime}</td></tr>` : ""}
      </table>
      <p style="margin-top:24px;font-size:12px;color:#aaa">Review attendance at /admin/schedule</p>
    </div>
  `
  return safeSend({ from: await fromAdmin(), to: [to], subject, html })
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
  const branding = await getEmailBranding()
  const { subject, html } = buildAccountReadyEmail({ customerName, magicLink, isRecurring }, branding)
  return safeSend({ from: await fromCustomer(), to: [toEmail], subject, html })
}

// ─────────────────────────────────────────────────────────────────
// 8b. Admin: Magic Link Login
// ─────────────────────────────────────────────────────────────────
export async function sendAdminMagicLinkEmail(toEmail: string, magicLink: string, locationId?: string) {
  const branding = await getEmailBranding(locationId)
  const subject = `🔑 Sign in to ${branding.businessName} Admin`
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="color:${branding.primaryColor};margin-bottom:12px">Admin Sign-In</h2>
      <p style="color:#444;font-size:14px;line-height:1.6;margin-bottom:24px">
        Click below to sign in to the ${branding.businessName} admin dashboard. This link is valid for a limited time and can only be used once.
      </p>
      <a href="${magicLink}" style="display:inline-block;background:${branding.accentColor};color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px">
        Sign In →
      </a>
      <p style="color:#999;font-size:12px;margin-top:28px">
        Didn't request this? You can safely ignore this email.
      </p>
    </div>
  `
  return safeSend({ from: await fromAdmin(locationId), to: [toEmail], subject, html })
}

// Replaces the one-time magic link above for new-admin provisioning. A
// magic link's token can be silently consumed by an automated email
// security scanner / link-preview fetch before the person ever opens the
// email -- confirmed root cause of a real tenant admin (Perfect Spin) never
// being able to sign in despite a real, valid invite. A plain password has
// nothing for a scanner to burn -- the only remaining dependency is the
// email actually arriving, not surviving a click race on top of that.
export async function sendAdminCredentialsEmail(toEmail: string, password: string, locationId?: string) {
  const branding = await getEmailBranding(locationId)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://comforterwash.com"
  const loginUrl = `${siteUrl}/admin/login`
  // Public, ungated copy of the tenant operations manual (app/guide/page.tsx)
  // -- linked instead of attached as a static PDF so it can never go stale
  // and never gets clipped by an attachment size/spam-filter limit.
  const guideUrl = `${siteUrl}/guide`
  const subject = `Your ${branding.businessName} admin login + operations guide`
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="color:${branding.primaryColor};margin-bottom:12px">Your admin login is ready</h2>
      <p style="color:#444;font-size:14px;line-height:1.6;margin-bottom:20px">
        Sign in to your ${branding.businessName} admin dashboard with the details below. You can change this password any time after signing in, under Settings.
      </p>
      <div style="background:#f7f8fb;border-radius:10px;padding:16px 20px;margin-bottom:24px">
        <p style="color:#444;font-size:13px;margin:0 0 8px"><strong>Email:</strong> ${toEmail}</p>
        <p style="color:#444;font-size:13px;margin:0;font-family:monospace"><strong>Password:</strong> ${password}</p>
      </div>
      <a href="${loginUrl}" style="display:inline-block;background:${branding.accentColor};color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px">
        Sign In →
      </a>
      <p style="color:#444;font-size:14px;line-height:1.6;margin-top:28px;margin-bottom:8px">
        Before your first order, take a few minutes with the operations guide -- it walks through the admin dashboard, driver app, and operator app step by step:
      </p>
      <a href="${guideUrl}" style="display:inline-block;color:${branding.accentColor};font-weight:700;font-size:14px;text-decoration:underline">
        View the Operations Guide →
      </a>
      <p style="color:#999;font-size:12px;margin-top:28px">
        Didn't request this? You can safely ignore this email.
      </p>
    </div>
  `
  return safeSend({ from: await fromAdmin(locationId), to: [toEmail], subject, html })
}

// ─────────────────────────────────────────────────────────────────
// Platform owner alert: a brand-new tenant just signed up and paid
// (self-signup checkout completed). Fires once per tenant from
// provisionSelfSignupTenant() -- the platform owner previously had no way
// of knowing a signup happened except by noticing it in Stripe.
// ─────────────────────────────────────────────────────────────────
export async function sendPlatformSignupAlert(data: {
  businessName: string
  slug: string
  contactEmail: string
  planName: string
  planPriceCents: number
  locationId: string
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://comforterwash.com"
  const adminUrl = `${siteUrl}/super-admin`
  const priceStr = `$${(data.planPriceCents / 100).toFixed(2)}`
  const subject = `🎉 New signup: ${data.businessName}`
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="color:#0D2240;margin-bottom:12px">New tenant signed up</h2>
      <div style="background:#f7f8fb;border-radius:10px;padding:16px 20px;margin-bottom:24px">
        <p style="color:#444;font-size:13px;margin:0 0 8px"><strong>Business:</strong> ${data.businessName}</p>
        <p style="color:#444;font-size:13px;margin:0 0 8px"><strong>Contact email:</strong> ${data.contactEmail}</p>
        <p style="color:#444;font-size:13px;margin:0 0 8px"><strong>Plan:</strong> ${data.planName} (${priceStr})</p>
        <p style="color:#444;font-size:13px;margin:0"><strong>Slug:</strong> ${data.slug}</p>
      </div>
      <p style="color:#444;font-size:14px;line-height:1.6;margin-bottom:20px">
        Their admin account and login credentials email were sent automatically. Worth a personal check-in over the next day or two to make sure they actually logged in.
      </p>
      <a href="${adminUrl}" style="display:inline-block;background:#0D2240;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px">
        View in Super Admin →
      </a>
    </div>
  `
  return safeSend({ from: `WashFoldClean <${SEND_DOMAIN}>`, to: [ADMIN_EMAIL], subject, html })
}

// New self-serve city added under Option B multi-city -- unlike a brand new
// tenant signup, there's no plan/price yet (billing stays a manual,
// super-admin-set step, same as every other tenant's first city). Just
// flags that a new location exists and needs a price set before it can be
// billed.
export async function sendNewCityAddedAlert(data: {
  businessName: string
  newCityName: string
  newLocationId: string
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://comforterwash.com"
  const adminUrl = `${siteUrl}/super-admin`
  const subject = `🏙️ ${data.businessName} added a new city: ${data.newCityName}`
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="color:#0D2240;margin-bottom:12px">New city added</h2>
      <div style="background:#f7f8fb;border-radius:10px;padding:16px 20px;margin-bottom:24px">
        <p style="color:#444;font-size:13px;margin:0 0 8px"><strong>Existing tenant:</strong> ${data.businessName}</p>
        <p style="color:#444;font-size:13px;margin:0"><strong>New city:</strong> ${data.newCityName}</p>
      </div>
      <p style="color:#444;font-size:14px;line-height:1.6;margin-bottom:20px">
        This city has no plan price set yet, so it isn't billed. Set a price and send a checkout link from Super Admin to start billing it as its own line item.
      </p>
      <a href="${adminUrl}" style="display:inline-block;background:#0D2240;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px">
        Set price in Super Admin →
      </a>
    </div>
  `
  return safeSend({ from: `WashFoldClean <${SEND_DOMAIN}>`, to: [ADMIN_EMAIL], subject, html })
}

// ─────────────────────────────────────────────────────────────────
// 9. Facility: Orders Arrived  (sent when driver completes to_facility run)
// ─────────────────────────────────────────────────────────────────
export interface FacilityArrivalData {
  facilityName: string
  driverName: string
  arrivedAt: string
  orders: Array<{
    shortCode: string
    customerName: string
    serviceType: string
    bags: number
  }>
}

export async function sendFacilityArrivalEmail(toEmail: string, data: FacilityArrivalData) {
  const count = data.orders.length
  const subject = `📦 ${count} order${count !== 1 ? "s" : ""} arrived — ${data.facilityName}`
  const rows = data.orders.map(o => `
    <tr style="border-bottom:1px solid #f3f4f6">
      <td style="padding:8px 0;font-weight:700;color:#0D2240;font-family:monospace">#${o.shortCode}</td>
      <td style="padding:8px 4px;color:#0D2240">${o.customerName}</td>
      <td style="padding:8px 0;color:#666">${o.serviceType}</td>
      <td style="padding:8px 0;color:#0D2240;text-align:right">${o.bags}</td>
    </tr>`).join("")

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#0D2240;margin-bottom:4px">Orders Arrived</h2>
      <p style="color:#666;font-size:14px;margin-bottom:20px">${data.facilityName}</p>
      <div style="background:#fdf6f5;border-radius:12px;padding:14px 16px;margin-bottom:20px">
        <p style="margin:0;font-size:14px;color:#0D2240">
          <strong>${count} order${count !== 1 ? "s" : ""}</strong> delivered by
          <strong>${data.driverName}</strong> at ${data.arrivedAt}
        </p>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="border-bottom:2px solid #e5e7eb">
            <th style="text-align:left;padding:8px 0;color:#888;font-weight:600">Order</th>
            <th style="text-align:left;padding:8px 4px;color:#888;font-weight:600">Customer</th>
            <th style="text-align:left;padding:8px 0;color:#888;font-weight:600">Service</th>
            <th style="text-align:right;padding:8px 0;color:#888;font-weight:600">Bags</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:24px;font-size:12px;color:#aaa">
        Mark orders as ready via your partner portal when washing is complete.
      </p>
    </div>`

  return safeSend({ from: await fromAdmin(), to: [toEmail], subject, html })
}

// ─────────────────────────────────────────────────────────────────
// 10. Admin: Abandoned/Failed Checkout Alert (sent once per attempt, the
// moment it flips to failed/expired — see markCheckoutAttemptFailed)
// ─────────────────────────────────────────────────────────────────
export interface AbandonedCheckoutAlertData {
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  serviceType: string | null
  amountCents: number | null
  status: "failed" | "expired"
  failureReason: string | null
}

const SERVICE_LABEL_MAP: Record<string, string> = {
  comforter_wash: "Comforter Wash",
  wash_fold:      "Wash & Fold",
  wash_only:      "Wash Only",
}

export async function sendAbandonedCheckoutAlertEmail(data: AbandonedCheckoutAlertData) {
  const branding = await getEmailBranding()
  const reasonLine = data.status === "failed"
    ? `Card declined${data.failureReason ? `: ${data.failureReason}` : ""}`
    : "Customer never completed checkout (session expired after 24h)"
  const amount = data.amountCents != null ? `$${(data.amountCents / 100).toFixed(2)}` : "—"
  const subject = `⚠️ Missed order — ${data.customerName ?? "a customer"} didn't complete checkout`
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:${branding.primaryColor};margin-bottom:4px">Checkout not completed</h2>
      <p style="color:#666;font-size:14px;margin-bottom:24px">${branding.businessName} · ${reasonLine}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px 0;color:#888;width:120px">Customer</td><td style="font-weight:600;color:${branding.primaryColor}">${data.customerName ?? "Unknown"}</td></tr>
        <tr><td style="padding:8px 0;color:#888">Phone</td><td style="color:${branding.primaryColor}">${data.customerPhone ? `<a href="tel:${data.customerPhone}" style="color:${branding.accentColor}">${data.customerPhone}</a>` : "—"}</td></tr>
        <tr><td style="padding:8px 0;color:#888">Email</td><td style="color:${branding.primaryColor}">${data.customerEmail ?? "—"}</td></tr>
        <tr><td style="padding:8px 0;color:#888">Service</td><td style="color:${branding.primaryColor}">${SERVICE_LABEL_MAP[data.serviceType ?? ""] ?? data.serviceType ?? "—"}</td></tr>
        <tr><td style="padding:8px 0;color:#888">Amount</td><td style="color:${branding.primaryColor}">${amount}</td></tr>
      </table>
      <p style="margin-top:24px;font-size:12px;color:#aaa">
        This customer clearly intended to book — reach out before they go somewhere else.
        Full list at /admin/abandoned-checkouts
      </p>
    </div>
  `
  return safeSend({ from: await fromAdmin(), to: await adminAlertRecipients(), subject, html })
}

// ─────────────────────────────────────────────────────────────────
// 10b. Admin: Booking landed on an excluded/full date. The booking form's
// datepicker greys these out client-side, but createBooking() has no
// server-side re-check — a stale form, a devtools bypass, or another
// booking filling the last capacity slot in the same moment could still
// land an order here. This never blocks the booking (the customer has
// already paid by the time this runs), it just makes sure a human sees it
// immediately instead of a driver being dispatched on a day the shop isn't
// running, or a home-capacity day quietly going over.
// ─────────────────────────────────────────────────────────────────
export interface DateConflictAlertData {
  bookingId: string
  shortCode: string | null
  customerName: string
  customerPhone: string | null
  pickupDate: string
  reason: "excluded_date" | "over_capacity"
}

export async function sendDateConflictAlertEmail(data: DateConflictAlertData) {
  const branding = await getEmailBranding()
  const reasonLine = data.reason === "excluded_date"
    ? "This date is marked as a holiday/closure or before the first available pickup date."
    : "This date is already at the home-based daily capacity limit."
  const subject = `⚠️ Order landed on a blocked date — ${data.shortCode ?? data.bookingId.slice(0, 8).toUpperCase()}`
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:${branding.primaryColor};margin-bottom:4px">Booking on a blocked date</h2>
      <p style="color:#666;font-size:14px;margin-bottom:24px">${branding.businessName} · ${reasonLine}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px 0;color:#888;width:120px">Order</td><td style="font-weight:600;color:${branding.primaryColor}">${data.shortCode ?? data.bookingId.slice(0, 8).toUpperCase()}</td></tr>
        <tr><td style="padding:8px 0;color:#888">Customer</td><td style="color:${branding.primaryColor}">${data.customerName}</td></tr>
        <tr><td style="padding:8px 0;color:#888">Phone</td><td style="color:${branding.primaryColor}">${data.customerPhone ? `<a href="tel:${data.customerPhone}" style="color:${branding.accentColor}">${data.customerPhone}</a>` : "—"}</td></tr>
        <tr><td style="padding:8px 0;color:#888">Pickup date</td><td style="color:${branding.primaryColor}">${data.pickupDate}</td></tr>
      </table>
      <p style="margin-top:24px;font-size:12px;color:#aaa">
        Payment already succeeded, so nothing was blocked automatically — reschedule this order from the dispatch board if the date genuinely doesn't work.
      </p>
    </div>
  `
  return safeSend({ from: await fromAdmin(), to: await adminAlertRecipients(), subject, html })
}

// ─────────────────────────────────────────────────────────────────
// 11. Customer: Gift Card Delivery (sent right after purchase — to the
// recipient if one was given, otherwise back to the purchaser to forward)
// ─────────────────────────────────────────────────────────────────
export interface GiftCardEmailData {
  toEmail: string
  recipientName?: string
  purchaserName?: string
  amountCents: number
  code: string
  message?: string
}

// ─────────────────────────────────────────────────────────────────
// 12. Commercial account: signup invite (admin-triggered) — link to the
// public /commercial-agreement/[code] page where the business fills in
// its own contact details, e-signs the agreement, and adds a card on file.
// ─────────────────────────────────────────────────────────────────
export interface CommercialInviteEmailData {
  toEmail: string
  businessName: string
  link: string
}

export async function sendCommercialAccountInviteEmail(data: CommercialInviteEmailData) {
  if (!data.toEmail) return null
  const branding = await getEmailBranding()
  const subject = `Set up your commercial account — ${branding.businessName}`
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:${branding.primaryColor};margin-bottom:4px">You're invited to set up a commercial account</h2>
      <p style="color:#666;font-size:14px;margin-bottom:24px">
        ${branding.businessName} would like to set up recurring commercial laundry service for <strong>${data.businessName}</strong>.
        Click below to review and sign the service agreement and add a payment method — it only takes a couple of minutes.
      </p>
      <div style="text-align:center;margin-bottom:24px">
        <a href="${data.link}" style="display:inline-block;background:${branding.accentColor};color:white;font-weight:800;font-size:14px;text-decoration:none;padding:14px 28px;border-radius:999px">
          Set Up Commercial Account →
        </a>
      </div>
      <p style="color:#999;font-size:12px;line-height:1.6">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${data.link}" style="color:${branding.accentColor}">${data.link}</a>
      </p>
      <p style="margin-top:24px;font-size:12px;color:#aaa">${branding.businessName} · ${branding.supportPhone}</p>
    </div>
  `
  return safeSend({ from: await fromAdmin(), to: [data.toEmail], subject, html })
}

// Distinct from the invite email above — that one says "you're invited to
// set up a commercial account," which is confusing/wrong to send an
// already-active account whose card just needs updating (e.g. after a
// "connection to the user's Link account has been closed" decline). Reuses
// the same access_code link (the agreement page already offers an "Update
// Payment Method" option once a card is on file), just with copy that
// matches what's actually being asked of them.
export async function sendPaymentUpdateNeededEmail(data: CommercialInviteEmailData) {
  if (!data.toEmail) return null
  const branding = await getEmailBranding()
  const subject = `Action needed: update your payment method — ${branding.businessName}`
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:${branding.primaryColor};margin-bottom:4px">Please update your payment method</h2>
      <p style="color:#666;font-size:14px;margin-bottom:24px">
        We ran into an issue charging the card on file for <strong>${data.businessName}</strong>'s account with ${branding.businessName}.
        Please update your payment method below so we can keep your orders running smoothly — it only takes a minute.
      </p>
      <div style="text-align:center;margin-bottom:24px">
        <a href="${data.link}" style="display:inline-block;background:${branding.accentColor};color:white;font-weight:800;font-size:14px;text-decoration:none;padding:14px 28px;border-radius:999px">
          Update Payment Method →
        </a>
      </div>
      <p style="color:#999;font-size:12px;line-height:1.6">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${data.link}" style="color:${branding.accentColor}">${data.link}</a>
      </p>
      <p style="margin-top:24px;font-size:12px;color:#aaa">${branding.businessName} · ${branding.supportPhone}</p>
    </div>
  `
  return safeSend({ from: await fromAdmin(), to: [data.toEmail], subject, html })
}

export async function sendGiftCardEmail(data: GiftCardEmailData) {
  if (!data.toEmail) return null
  const branding = await getEmailBranding()
  const amount = `$${(data.amountCents / 100).toFixed(2)}`
  const greeting = data.recipientName ? `Hi ${data.recipientName},` : "Hi there,"
  const fromLine = data.purchaserName ? `${data.purchaserName} sent you a gift card!` : "You've received a gift card!"
  const subject = `🎁 ${fromLine} (${amount}) — ${branding.businessName}`
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:${branding.primaryColor};margin-bottom:4px">${fromLine}</h2>
      <p style="color:#666;font-size:14px;margin-bottom:24px">${greeting}</p>
      <div style="background:${branding.primaryColor};border-radius:16px;padding:28px;text-align:center;margin-bottom:20px">
        <p style="color:rgba(255,255,255,0.6);font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px">Gift Card Value</p>
        <p style="color:white;font-size:36px;font-weight:800;margin:0 0 16px">${amount}</p>
        <p style="color:rgba(255,255,255,0.6);font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px">Redemption Code</p>
        <p style="color:${branding.accentColor};font-size:22px;font-weight:800;letter-spacing:2px;margin:0;font-family:monospace">${data.code}</p>
      </div>
      ${data.message ? `<p style="color:#555;font-size:14px;font-style:italic;background:#f8f8f8;border-radius:8px;padding:14px;margin-bottom:20px">"${data.message}"</p>` : ""}
      <p style="color:#666;font-size:13px;line-height:1.6">
        Use this code at checkout on any ${branding.websiteDomain} order — comforter wash, wash &amp; fold, or wash only.
        It can be used across multiple orders until the balance runs out.
      </p>
      <p style="margin-top:24px;font-size:12px;color:#aaa">${branding.businessName} · ${branding.supportPhone}</p>
    </div>
  `
  return safeSend({ from: await fromCustomer(), to: [data.toEmail], subject, html })
}
