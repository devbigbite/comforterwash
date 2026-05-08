// ─────────────────────────────────────────────────────────────────
// WashFold Orlando — Email HTML Templates
// Brand colors: navy #0D2240, coral #E8726A, light bg #f7f8fb
// ─────────────────────────────────────────────────────────────────

const BASE_STYLES = `
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #f7f8fb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 580px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(13,34,64,.08); }
    .header { background: #0D2240; padding: 28px 32px; text-align: center; }
    .logo-text { font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
    .logo-coral { color: #E8726A; }
    .body { padding: 32px; }
    .hero-badge { display: inline-block; background: #f7f8fb; border-radius: 999px; padding: 6px 16px; font-size: 13px; font-weight: 600; color: #0D2240; margin-bottom: 20px; }
    h1 { font-size: 24px; font-weight: 800; color: #0D2240; margin-bottom: 8px; line-height: 1.2; }
    .subtitle { font-size: 15px; color: #6b7280; margin-bottom: 28px; line-height: 1.5; }
    .detail-card { background: #f7f8fb; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    .detail-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .detail-row:last-child { border-bottom: none; padding-bottom: 0; }
    .detail-label { font-size: 13px; color: #6b7280; font-weight: 500; min-width: 130px; }
    .detail-value { font-size: 14px; color: #111827; font-weight: 600; text-align: right; }
    .cta-button { display: block; background: #E8726A; color: #ffffff !important; text-decoration: none; text-align: center; padding: 14px 28px; border-radius: 10px; font-size: 15px; font-weight: 700; margin: 24px 0; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
    .footer { padding: 20px 32px; text-align: center; background: #f7f8fb; border-top: 1px solid #e5e7eb; }
    .footer p { font-size: 12px; color: #9ca3af; line-height: 1.6; }
    .footer a { color: #E8726A; text-decoration: none; }
    .status-pill { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: 0.3px; }
    .pill-blue { background: #dbeafe; color: #1d4ed8; }
    .pill-green { background: #dcfce7; color: #16a34a; }
    .pill-coral { background: #fee2e2; color: #dc2626; }
    .alert-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 16px; margin-bottom: 20px; }
    .alert-box p { font-size: 14px; color: #92400e; }
    @media (max-width: 600px) {
      .detail-row { flex-direction: column; gap: 2px; }
      .detail-value { text-align: left; }
    }
  </style>
`

function emailShell(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${BASE_STYLES}
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="logo-text">Wash<span class="logo-coral">Fold</span> Orlando</div>
      </div>
      ${content}
    </div>
    <div style="text-align:center;margin-top:20px;">
      <p style="font-size:11px;color:#9ca3af;">© 2025 WashFold Orlando · <a href="https://washfoldorlando.com" style="color:#E8726A;">washfoldorlando.com</a></p>
    </div>
  </div>
</body>
</html>`
}

function detailRow(label: string, value: string): string {
  return `<div class="detail-row">
    <span class="detail-label">${label}</span>
    <span class="detail-value">${value}</span>
  </div>`
}

// ─── SERVICE LABEL HELPER ─────────────────────────────────────────
function serviceLabel(serviceType: string): string {
  if (serviceType === "wash_fold") return "Wash &amp; Fold"
  if (serviceType === "wash_only") return "Wash Only"
  return "Comforter Wash"
}
// ─── DB OVERRIDE TYPE ────────────────────────────────────────────
export interface EmailTemplateOverride {
  subject?: string | null
  headline?: string | null
  body?: string | null
  cta_text?: string | null
}

// ─── 1. CUSTOMER BOOKING CONFIRMATION ────────────────────────────
export interface BookingConfirmationData {
  customerName: string
  customerEmail: string
  serviceType: string
  pickupDate: string
  pickupTimeWindow: string
  deliveryDate: string
  deliveryTimeWindow: string
  pickupAddress: string
  numComforters?: number
  comforterSize?: string
  pounds?: number
  estimatedTotal: string   // e.g. "$48.00"
  bookingId: string
}

export function buildBookingConfirmationEmail(d: BookingConfirmationData, ov: EmailTemplateOverride = {}): { subject: string; html: string } {
  const firstName = d.customerName.split(" ")[0]
  const isComforter = d.serviceType === "comforter_wash"
  const isWashFold  = d.serviceType === "wash_fold"

  let itemRow = ""
  if (isComforter) {
    itemRow = detailRow("Item(s)", `${d.numComforters ?? 1} comforter${(d.numComforters ?? 1) > 1 ? "s" : ""}${d.comforterSize ? ` (${d.comforterSize})` : ""}`)
  } else if (isWashFold && d.pounds) {
    itemRow = detailRow("Est. weight", `${d.pounds} lbs`)
  }

  const html = emailShell(`
    <div class="body">
      <div class="hero-badge">✅ Booking Confirmed</div>
      <h1>${ov.headline ?? `You're all set, ${firstName}!`}</h1>
      <p class="subtitle">${ov.body ?? "Your laundry pickup is scheduled. We'll send a reminder the morning of pickup — just have everything ready."}</p>

      <div class="detail-card">
        ${detailRow("Service", serviceLabel(d.serviceType))}
        ${itemRow}
        ${detailRow("Pickup", `${d.pickupDate} · ${d.pickupTimeWindow}`)}
        ${detailRow("Delivery", `${d.deliveryDate} · ${d.deliveryTimeWindow}`)}
        ${detailRow("Pickup address", d.pickupAddress)}
        ${detailRow("Est. total", d.estimatedTotal)}
        ${detailRow("Booking #", `<span style="font-family:monospace;font-size:12px;">${d.bookingId.slice(0, 8).toUpperCase()}</span>`)}
      </div>

      <div class="alert-box">
        <p>💡 <strong>Heads up:</strong> Your card is pre-authorized. For Wash &amp; Fold and Wash Only orders, the final charge is based on actual weight — so you only pay for what you send.</p>
      </div>

      <p style="font-size:14px;color:#374151;margin-bottom:8px;">Questions? Reply to this email or text us anytime.</p>
      <p style="font-size:14px;color:#374151;"><strong>📞 (407) 123-4567</strong></p>
    </div>
    <div class="footer">
      <p>WashFold Orlando · Pickup &amp; Delivery Laundry Service<br/>
      <a href="https://washfoldorlando.com">washfoldorlando.com</a></p>
    </div>
  `)

  return {
    subject: ov.subject?.replace(/\{\{service_type\}\}/g, serviceLabel(d.serviceType).replace(/&amp;/g, "&")).replace(/\{\{pickup_date\}\}/g, d.pickupDate) ?? `✅ Booking confirmed — ${serviceLabel(d.serviceType).replace(/&amp;/g, "&")} pickup ${d.pickupDate}`,
    html,
  }
}

// ─── 2. ADMIN NEW ORDER ALERT ─────────────────────────────────────
export interface AdminNewOrderData {
  customerName: string
  customerEmail: string
  customerPhone: string
  serviceType: string
  pickupDate: string
  pickupTimeWindow: string
  deliveryDate: string
  deliveryTimeWindow: string
  pickupAddress: string
  numComforters?: number
  comforterSize?: string
  pounds?: number
  preAuthTotal: string
  bookingId: string
  subscriptionFrequency?: string
}

export function buildAdminNewOrderEmail(d: AdminNewOrderData, ov: EmailTemplateOverride = {}): { subject: string; html: string } {
  const isRecurring = d.subscriptionFrequency && d.subscriptionFrequency !== "one_time"
  const freqLabel = d.subscriptionFrequency === "weekly" ? "Weekly" : d.subscriptionFrequency === "biweekly" ? "Bi-weekly" : "One-time"

  let itemRow = ""
  if (d.serviceType === "comforter_wash") {
    itemRow = detailRow("Item(s)", `${d.numComforters ?? 1} comforter${(d.numComforters ?? 1) > 1 ? "s" : ""}${d.comforterSize ? ` · ${d.comforterSize}` : ""}`)
  } else if (d.pounds) {
    itemRow = detailRow("Est. weight", `${d.pounds} lbs`)
  }

  const html = emailShell(`
    <div class="body">
      <div class="hero-badge">🔔 New Order</div>
      <h1>${ov.headline ?? "New booking received!"}</h1>
      <p class="subtitle">${ov.body ?? "A customer just completed checkout. Review the details below."}</p>

      ${isRecurring ? `<div style="background:#dcfce7;border-radius:10px;padding:12px 16px;margin-bottom:20px;"><p style="font-size:14px;color:#16a34a;font-weight:700;">♻️ Recurring subscription — ${freqLabel}</p></div>` : ""}

      <div class="detail-card">
        ${detailRow("Customer", `${d.customerName}`)}
        ${detailRow("Email", `<a href="mailto:${d.customerEmail}" style="color:#E8726A;">${d.customerEmail}</a>`)}
        ${detailRow("Phone", `<a href="tel:${d.customerPhone}" style="color:#E8726A;">${d.customerPhone}</a>`)}
        ${detailRow("Service", serviceLabel(d.serviceType))}
        ${itemRow}
        ${detailRow("Pickup", `${d.pickupDate} · ${d.pickupTimeWindow}`)}
        ${detailRow("Delivery", `${d.deliveryDate} · ${d.deliveryTimeWindow}`)}
        ${detailRow("Address", d.pickupAddress)}
        ${detailRow("Pre-auth total", d.preAuthTotal)}
        ${detailRow("Booking ID", `<span style="font-family:monospace;font-size:12px;">${d.bookingId}</span>`)}
      </div>

      <a href="https://washfoldorlando.com/admin" class="cta-button">View in Admin Dashboard →</a>
    </div>
    <div class="footer">
      <p>This is an internal alert for WashFold Orlando staff.</p>
    </div>
  `)

  return {
    subject: ov.subject?.replace(/\{\{customer_name\}\}/g, d.customerName).replace(/\{\{service_type\}\}/g, freqLabel.toLowerCase()).replace(/\{\{pickup_date\}\}/g, d.pickupDate) ?? `🔔 New ${freqLabel.toLowerCase()} order — ${d.customerName} · ${d.pickupDate}`,
    html,
  }
}

// ─── 3. PICKUP REMINDER (sent morning of pickup) ───────────────────
export interface PickupReminderData {
  customerName: string
  pickupDate: string
  pickupTimeWindow: string
  pickupAddress: string
  serviceType: string
}

export function buildPickupReminderEmail(d: PickupReminderData, ov: EmailTemplateOverride = {}): { subject: string; html: string } {
  const firstName = d.customerName.split(" ")[0]

  const html = emailShell(`
    <div class="body">
      <div class="hero-badge">🚗 Pickup Today</div>
      <h1>${ov.headline?.replace(/\{\{first_name\}\}/g, firstName) ?? `We're coming today, ${firstName}!`}</h1>
      <p class="subtitle">${ov.body?.replace(/\{\{pickup_time\}\}/g, d.pickupTimeWindow) ?? "Just a reminder — your laundry pickup is scheduled for this morning. Please have everything ready to go."}</p>

      <div class="detail-card">
        ${detailRow("Service", serviceLabel(d.serviceType))}
        ${detailRow("Pickup window", d.pickupTimeWindow)}
        ${detailRow("Address", d.pickupAddress)}
      </div>

      <div class="alert-box">
        <p>📦 <strong>Getting ready?</strong> Please have your laundry in bags near the front door. Our driver will knock/ring and wait a couple minutes.</p>
      </div>

      <p style="font-size:14px;color:#374151;">Need to reschedule or have questions? Text or call us ASAP.</p>
      <p style="font-size:14px;color:#374151;margin-top:8px;"><strong>📞 (407) 123-4567</strong></p>
    </div>
    <div class="footer">
      <p>WashFold Orlando · <a href="https://washfoldorlando.com">washfoldorlando.com</a></p>
    </div>
  `)

  return {
    subject: ov.subject?.replace(/\{\{first_name\}\}/g, firstName).replace(/\{\{pickup_time\}\}/g, d.pickupTimeWindow) ?? `🚗 Pickup today ${d.pickupTimeWindow} — WashFold Orlando`,
    html,
  }
}

// ─── 4. ORDER PICKED UP CONFIRMATION ─────────────────────────────
export interface OrderPickedUpData {
  customerName: string
  deliveryDate: string
  deliveryTimeWindow: string
  serviceType: string
  numComforters?: number
  pounds?: number
}

export function buildOrderPickedUpEmail(d: OrderPickedUpData, ov: EmailTemplateOverride = {}): { subject: string; html: string } {
  const firstName = d.customerName.split(" ")[0]
  let itemText = "your laundry"
  if (d.serviceType === "comforter_wash") {
    itemText = `your ${d.numComforters ?? 1} comforter${(d.numComforters ?? 1) > 1 ? "s" : ""}`
  }

  const html = emailShell(`
    <div class="body">
      <div class="hero-badge">✅ Picked Up</div>
      <h1>${ov.headline?.replace(/\{\{first_name\}\}/g, firstName) ?? `We've got ${itemText}!`}</h1>
      <p class="subtitle">${ov.body?.replace(/\{\{delivery_date\}\}/g, d.deliveryDate).replace(/\{\{delivery_time\}\}/g, d.deliveryTimeWindow) ?? "Everything was picked up successfully. We're on it — your items are being professionally cleaned right now."}</p>

      <div class="detail-card">
        ${detailRow("Service", serviceLabel(d.serviceType))}
        ${d.pounds ? detailRow("Weight", `${d.pounds} lbs`) : ""}
        ${detailRow("Delivery", `${d.deliveryDate} · ${d.deliveryTimeWindow}`)}
      </div>

      <p style="font-size:14px;color:#374151;">We'll send another update when your order is out for delivery. Stay fresh! 👕</p>
    </div>
    <div class="footer">
      <p>WashFold Orlando · <a href="https://washfoldorlando.com">washfoldorlando.com</a></p>
    </div>
  `)

  return {
    subject: ov.subject?.replace(/\{\{first_name\}\}/g, firstName).replace(/\{\{delivery_date\}\}/g, d.deliveryDate) ?? `✅ Picked up! Delivery on ${d.deliveryDate} — WashFold Orlando`,
    html,
  }
}

// ─── 5. OUT FOR DELIVERY ──────────────────────────────────────────
export interface OutForDeliveryData {
  customerName: string
  deliveryDate: string
  deliveryTimeWindow: string
  deliveryAddress: string
  serviceType: string
  finalTotal?: string
}

export function buildOutForDeliveryEmail(d: OutForDeliveryData, ov: EmailTemplateOverride = {}): { subject: string; html: string } {
  const firstName = d.customerName.split(" ")[0]

  const html = emailShell(`
    <div class="body">
      <div class="hero-badge">🚗 Out for Delivery</div>
      <h1>${ov.headline?.replace(/\{\{first_name\}\}/g, firstName) ?? `Your clean laundry is on the way, ${firstName}!`}</h1>
      <p class="subtitle">${ov.body?.replace(/\{\{delivery_time\}\}/g, d.deliveryTimeWindow) ?? "Fresh and clean — your order is out for delivery. Be home or leave instructions for the driver."}</p>

      <div class="detail-card">
        ${detailRow("Delivery window", d.deliveryTimeWindow)}
        ${detailRow("Delivering to", d.deliveryAddress)}
        ${d.finalTotal ? detailRow("Final total", d.finalTotal) : ""}
      </div>

      <div class="alert-box">
        <p>🏡 <strong>Not home?</strong> Text us a safe place to leave your order and we'll take care of it.</p>
      </div>

      <p style="font-size:14px;color:#374151;"><strong>📞 (407) 123-4567</strong></p>
    </div>
    <div class="footer">
      <p>WashFold Orlando · <a href="https://washfoldorlando.com">washfoldorlando.com</a></p>
    </div>
  `)

  return {
    subject: ov.subject?.replace(/\{\{first_name\}\}/g, firstName).replace(/\{\{delivery_time\}\}/g, d.deliveryTimeWindow) ?? `🚗 Out for delivery today ${d.deliveryTimeWindow} — WashFold Orlando`,
    html,
  }
}

// ─── 6. DELIVERED ─────────────────────────────────────────────────
export interface DeliveredData {
  customerName: string
  serviceType: string
  finalTotal?: string
  bookingId: string
}

export function buildDeliveredEmail(d: DeliveredData, ov: EmailTemplateOverride = {}): { subject: string; html: string } {
  const firstName = d.customerName.split(" ")[0]

  const html = emailShell(`
    <div class="body">
      <div class="hero-badge">🎉 Delivered!</div>
      <h1>${ov.headline?.replace(/\{\{first_name\}\}/g, firstName) ?? `Enjoy your fresh laundry, ${firstName}!`}</h1>
      <p class="subtitle">${ov.body?.replace(/\{\{first_name\}\}/g, firstName) ?? "Your order has been delivered. Everything should be clean, fresh, and ready to use."}</p>

      ${d.finalTotal ? `<div class="detail-card">${detailRow("Final charge", d.finalTotal)}</div>` : ""}

      <p style="font-size:14px;color:#374151;margin-bottom:16px;">We'd love to hear how it went! Your feedback helps us keep improving. 🙏</p>

      <a href="https://g.page/r/washfoldorlando/review" class="cta-button">${ov.cta_text ?? "Leave Us a Google Review ⭐"}</a>

      <p style="font-size:13px;color:#9ca3af;margin-top:16px;">Booking #${d.bookingId.slice(0, 8).toUpperCase()} · <a href="https://washfoldorlando.com" style="color:#E8726A;">Book again</a></p>
    </div>
    <div class="footer">
      <p>Thank you for choosing WashFold Orlando!<br/>
      <a href="https://washfoldorlando.com">washfoldorlando.com</a></p>
    </div>
  `)

  return {
    subject: ov.subject?.replace(/\{\{first_name\}\}/g, firstName) ?? `🎉 Delivered! Thanks for choosing WashFold Orlando`,
    html,
  }
}
