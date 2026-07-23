"use server"

import { Resend } from "resend"
import { getBranding } from "@/lib/location"

const resend = new Resend(process.env.RESEND_API_KEY ?? "re_missing")
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "jbtanon@gmail.com"
// Sending domain is deliberately fixed for now — real per-tenant sending
// domains are a bigger future lift (see lib/email.ts SEND_DOMAIN). The
// display name and body copy below use the tenant's own branding.
const SEND_ADDRESS = "clean@washfoldorlando.com"

export async function sendContactMessage(formData: FormData) {
  const name    = (formData.get("name")    as string ?? "").trim()
  const phone   = (formData.get("phone")   as string ?? "").trim()
  const email   = (formData.get("email")   as string ?? "").trim()
  const message = (formData.get("message") as string ?? "").trim()

  if (!name || !message) {
    return { error: "Name and message are required." }
  }

  try {
    const branding = await getBranding()
    const businessName = branding.business_name || "WashFoldClean"
    const result = await resend.emails.send({
      from: `${businessName} <${SEND_ADDRESS}>`,
      to: [ADMIN_EMAIL],
      ...(email ? { replyTo: email } : {}),
      subject: `\u{1F4AC} New message from ${name}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
          <h2 style="color:#0D2240;margin-bottom:4px;">New Customer Message</h2>
          <p style="color:#888;font-size:13px;margin-bottom:24px;">Received via ${businessName} website</p>

          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr>
              <td style="padding:10px 12px;background:#f8f8f8;border-radius:6px 6px 0 0;font-weight:700;color:#0D2240;width:100px;">Name</td>
              <td style="padding:10px 12px;background:#f8f8f8;border-radius:6px 6px 0 0;">${name}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;border-top:1px solid #eee;font-weight:700;color:#0D2240;">Phone</td>
              <td style="padding:10px 12px;border-top:1px solid #eee;">${phone || "—"}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;border-top:1px solid #eee;background:#f8f8f8;font-weight:700;color:#0D2240;">Email</td>
              <td style="padding:10px 12px;border-top:1px solid #eee;background:#f8f8f8;">${email || "—"}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;border-top:1px solid #eee;background:#f8f8f8;font-weight:700;color:#0D2240;vertical-align:top;">Message</td>
              <td style="padding:10px 12px;border-top:1px solid #eee;background:#f8f8f8;white-space:pre-wrap;">${message}</td>
            </tr>
          </table>

          ${phone ? `<p style="margin-top:20px;"><a href="tel:${phone}" style="background:#E8726A;color:white;padding:10px 20px;border-radius:999px;text-decoration:none;font-weight:700;font-size:13px;">Call ${name}</a></p>` : ""}
        </div>
      `,
    })

    if (result.error) {
      console.error("[contact] Resend error:", result.error)
      return { error: "Could not send message. Please try again." }
    }

    return { success: true }
  } catch (err) {
    console.error("[contact] Failed:", err)
    return { error: "Could not send message. Please try again." }
  }
}
