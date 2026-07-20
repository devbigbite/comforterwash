"use server"

import { Resend } from "resend"
import { getBranding } from "@/lib/location"

const resend = new Resend(process.env.RESEND_API_KEY ?? "re_missing")
// Sending domain is deliberately fixed for now — see note in contact.ts.
const SEND_ADDRESS = "clean@washfoldorlando.com"
const TO     = process.env.ADMIN_EMAIL ?? "jbtanon@gmail.com"

export async function submitCommercialInquiry(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  // Spam guards
  const honeypot  = (formData.get("_company") as string) ?? ""
  const loadedAt  = parseInt((formData.get("_loaded_at") as string) ?? "0", 10)
  const elapsed   = Date.now() - loadedAt

  if (honeypot.length > 0) {
    // Bot filled the hidden field — silently succeed so the bot doesn't retry
    return { success: true }
  }
  if (loadedAt > 0 && elapsed < 3000) {
    // Submitted in under 3 seconds — almost certainly a bot
    return { success: false, error: "Please take a moment to review your information before submitting." }
  }

  const businessName   = (formData.get("business_name") as string)?.trim()
  const contact        = (formData.get("contact") as string)?.trim()
  const email          = (formData.get("email") as string)?.trim()
  const phone          = (formData.get("phone") as string)?.trim()
  const businessType   = (formData.get("business_type") as string)?.trim()
  const weeklyVolume   = (formData.get("weekly_volume") as string)?.trim() || null
  const preferredDays  = (formData.get("preferred_days") as string)?.trim() || null
  const otherType      = (formData.get("other_type") as string)?.trim() || null

  if (!businessName || !contact || !email || !phone || !businessType) {
    return { success: false, error: "Please fill in all required fields." }
  }

  const branding = await getBranding()
  const businessName2 = branding.business_name || "Your Business"

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f7f8fb;padding:24px;border-radius:12px;">
      <div style="background:#0D2240;padding:24px;border-radius:10px;margin-bottom:24px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:22px;">New Commercial Inquiry</h1>
        <p style="color:#E8726A;margin:6px 0 0;font-size:14px;">${businessName2} — Commercial Services</p>
      </div>

      <div style="background:#fff;border-radius:10px;padding:24px;border:1px solid #e5e7eb;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:10px 12px;background:#f7f8fb;border-radius:6px;font-weight:bold;color:#0D2240;font-size:13px;width:40%;">Business Name</td>
            <td style="padding:10px 12px;color:#374151;font-size:13px;">${businessName}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px;font-weight:bold;color:#0D2240;font-size:13px;">Owner / Manager</td>
            <td style="padding:10px 12px;color:#374151;font-size:13px;">${contact}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px;background:#f7f8fb;border-radius:6px;font-weight:bold;color:#0D2240;font-size:13px;">Email</td>
            <td style="padding:10px 12px;color:#374151;font-size:13px;"><a href="mailto:${email}" style="color:#E8726A;">${email}</a></td>
          </tr>
          <tr>
            <td style="padding:10px 12px;font-weight:bold;color:#0D2240;font-size:13px;">Phone</td>
            <td style="padding:10px 12px;color:#374151;font-size:13px;"><a href="tel:${phone}" style="color:#E8726A;">${phone}</a></td>
          </tr>
          <tr>
            <td style="padding:10px 12px;background:#f7f8fb;border-radius:6px;font-weight:bold;color:#0D2240;font-size:13px;">Business Type</td>
            <td style="padding:10px 12px;color:#374151;font-size:13px;">${businessType}</td>
          </tr>
          ${otherType ? `
          <tr>
            <td style="padding:10px 12px;font-weight:bold;color:#0D2240;font-size:13px;">Business Description</td>
            <td style="padding:10px 12px;color:#374151;font-size:13px;">${otherType}</td>
          </tr>` : ""}
          ${weeklyVolume ? `
          <tr>
            <td style="padding:10px 12px;font-weight:bold;color:#0D2240;font-size:13px;">Est. Weekly Volume</td>
            <td style="padding:10px 12px;color:#374151;font-size:13px;">${weeklyVolume}</td>
          </tr>` : ""}
          ${preferredDays ? `
          <tr>
            <td style="padding:10px 12px;background:#f7f8fb;border-radius:6px;font-weight:bold;color:#0D2240;font-size:13px;">Preferred Days</td>
            <td style="padding:10px 12px;color:#374151;font-size:13px;">${preferredDays}</td>
          </tr>` : ""}
        </table>
      </div>

      <p style="text-align:center;margin-top:20px;color:#9ca3af;font-size:12px;">
        Submitted via ${businessName2} Commercial page
      </p>
    </div>
  `

  try {
    const result = await resend.emails.send({
      from:    `${businessName2} <${SEND_ADDRESS}>`,
      to:      TO,
      replyTo: email,
      subject: `Commercial Inquiry: ${businessName} (${businessType})`,
      html,
    })

    if (result.error) {
      console.error("[commercial-inquiry] Resend error:", result.error)
      return { success: false, error: "Failed to send. Please try emailing us directly." }
    }

    return { success: true }
  } catch (err) {
    console.error("[commercial-inquiry] Error:", err)
    return { success: false, error: "Something went wrong. Please try again." }
  }
}
