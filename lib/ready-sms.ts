"use server"

// ── Ready (tryready.com) — promotional/marketing SMS only ───────────────────
// Deliberately separate from lib/sms.ts's Twilio-backed sendSMS(), which
// stays scoped to transactional sends (booking confirmations, pickup
// reminders, driver-on-the-way, etc). Splitting the rails means:
//   - Ready's own A2P 10DLC campaign registration only has to cover
//     marketing use, not the platform's transactional volume.
//   - A carrier/compliance issue on one rail (e.g. Ready getting flagged
//     for marketing content) can't take down transactional delivery, and
//     vice versa.
//   - Every call site here is a natural, auditable list of every place the
//     platform sends promotional SMS -- see app/actions/sms-campaigns.ts.
//
// Callers are still responsible for checking customers.sms_marketing_consent
// before calling this -- this function only sends, it doesn't gate consent.

export async function sendPromotionalSMS(
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.READY_API_KEY
  if (!apiKey) {
    console.error("[ReadySMS] Missing READY_API_KEY env var")
    return { success: false, error: "Ready not configured" }
  }

  // Normalize to E.164 (+1XXXXXXXXXX), same convention as lib/sms.ts.
  const digits = phoneNumber.replace(/\D/g, "")
  const to = digits.startsWith("1") ? `+${digits}` : `+1${digits}`

  // READY_FROM_NUMBER pins sends to one purchased number (recommended once
  // a real number + 10DLC campaign is registered for marketing use).
  // Without it, from_strategy lets Ready pick from whatever pool is
  // available on the account -- fine for initial testing, not for
  // production volume/deliverability.
  const fromNumber = process.env.READY_FROM_NUMBER
  const body: Record<string, string> = { to, message }
  if (fromNumber) body.from = fromNumber
  else body.from_strategy = "even"

  try {
    const res = await fetch("https://api.tryready.com/sms/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const json = (await res.json().catch(() => ({}))) as {
      id?: string
      status?: string
      error?: string
      message?: string
    }

    if (!res.ok) {
      console.error("[ReadySMS] error:", json.error ?? json.message ?? res.statusText)
      return { success: false, error: json.error ?? json.message ?? `Ready error (${res.status})` }
    }

    console.log(`[ReadySMS] Sent to ${to} — id: ${json.id ?? "?"} status: ${json.status ?? "?"}`)
    return { success: true }
  } catch (err) {
    console.error("[ReadySMS] Network error:", err)
    return { success: false, error: String(err) }
  }
}
