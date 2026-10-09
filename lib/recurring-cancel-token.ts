import { createHmac, timingSafeEqual } from "crypto"

// Signed, unguessable token for the "cancel my recurring pickup" link in the
// booking confirmation email. Lets a customer stop a recurring subscription
// without needing an account. Pure helpers — no "use server".

function sig(id: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "missing-secret"
  return createHmac("sha256", secret).update(`recurring-cancel:${id}`).digest("base64url")
}

export function signRecurringCancelToken(subscriptionId: string): string {
  return `${subscriptionId}.${sig(subscriptionId)}`
}

/** Returns the subscription id if the token is valid, else null. */
export function verifyRecurringCancelToken(token: string): string | null {
  const i = token.lastIndexOf(".")
  if (i <= 0) return null
  const id = token.slice(0, i)
  const given = Buffer.from(token.slice(i + 1))
  const expected = Buffer.from(sig(id))
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  return id
}
