"use server"

import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY ?? "re_missing")
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "jbtanon@gmail.com"
const SEND_ADDRESS = "clean@washfoldorlando.com"

// Demo requests from the SaaS platform's own promo page (/platform) — distinct
// from app/actions/contact.ts, which is a tenant's own "Message Us" form on
// their customer-facing site. This one always goes to the platform owner,
// regardless of which tenant's hostname happens to serve the request.
export async function requestPlatformDemo(formData: FormData) {
  const name    = (formData.get("name")    as string ?? "").trim()
  const email   = (formData.get("email")   as string ?? "").trim()
  const phone   = (formData.get("phone")   as string ?? "").trim()
  const business = (formData.get("business") as string ?? "").trim()
  const message = (formData.get("message") as string ?? "").trim()

  if (!name || !email) {
    return { error: "Name and email are required." }
  }

  try {
    const result = await resend.emails.send({
      from: `WashFoldClean Platform <${SEND_ADDRESS}>`,
      to: [ADMIN_EMAIL],
      replyTo: email,
      subject: `\u{1F4E6} New demo request from ${name}${business ? ` (${business})` : ""}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
          <h2 style="color:#0D2240;margin-bottom:4px;">New Demo Request</h2>
          <p style="color:#888;font-size:13px;margin-bottom:24px;">Submitted via the platform promo site (/platform)</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:10px 12px;background:#f8f8f8;font-weight:700;color:#0D2240;width:120px;">Name</td><td style="padding:10px 12px;background:#f8f8f8;">${name}</td></tr>
            <tr><td style="padding:10px 12px;border-top:1px solid #eee;font-weight:700;color:#0D2240;">Email</td><td style="padding:10px 12px;border-top:1px solid #eee;">${email}</td></tr>
            <tr><td style="padding:10px 12px;border-top:1px solid #eee;background:#f8f8f8;font-weight:700;color:#0D2240;">Phone</td><td style="padding:10px 12px;border-top:1px solid #eee;background:#f8f8f8;">${phone || "—"}</td></tr>
            <tr><td style="padding:10px 12px;border-top:1px solid #eee;font-weight:700;color:#0D2240;">Business</td><td style="padding:10px 12px;border-top:1px solid #eee;">${business || "—"}</td></tr>
            <tr><td style="padding:10px 12px;border-top:1px solid #eee;background:#f8f8f8;font-weight:700;color:#0D2240;vertical-align:top;">Message</td><td style="padding:10px 12px;border-top:1px solid #eee;background:#f8f8f8;white-space:pre-wrap;">${message || "—"}</td></tr>
          </table>
        </div>
      `,
    })

    if (result.error) {
      console.error("[platform-contact] Resend error:", result.error)
      return { error: "Could not send your request. Please try again." }
    }

    return { success: true }
  } catch (err) {
    console.error("[platform-contact] Failed:", err)
    return { error: "Could not send your request. Please try again." }
  }
}
