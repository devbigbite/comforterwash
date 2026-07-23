/**
 * lib/resend-domains.ts
 *
 * Thin wrapper around Resend's Domains API — lets a tenant verify their own
 * sending domain (e.g. mail.theirbusiness.com) so booking/reminder emails
 * come from their own brand instead of the shared clean@washfoldorlando.com
 * address. Each tenant still uses the SAME Resend account/API key (this is
 * a domain-verification problem, not an account-isolation one) — Resend
 * supports many verified domains on a single account.
 */

const RESEND_API_BASE = "https://api.resend.com"

export interface ResendDnsRecord {
  record: string   // e.g. "SPF", "DKIM", "MX", "DMARC"
  name: string
  type: string      // "TXT" | "MX" | "CNAME"
  value: string
  priority?: number
  ttl?: string
  status?: string   // "pending" | "verified" | "not_started" | "failed"
}

export interface ResendDomain {
  id: string
  name: string
  status: string // "not_started" | "pending" | "verified" | "failed" | "temporary_failure"
  records: ResendDnsRecord[]
}

function authHeaders() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured")
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  }
}

export async function createResendDomain(domain: string): Promise<ResendDomain> {
  const res = await fetch(`${RESEND_API_BASE}/domains`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name: domain }),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json?.message ?? `Resend API error (${res.status})`)
  }
  return json as ResendDomain
}

export async function getResendDomain(domainId: string): Promise<ResendDomain> {
  const res = await fetch(`${RESEND_API_BASE}/domains/${domainId}`, {
    method: "GET",
    headers: authHeaders(),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json?.message ?? `Resend API error (${res.status})`)
  }
  return json as ResendDomain
}

export async function verifyResendDomain(domainId: string): Promise<{ success: boolean }> {
  const res = await fetch(`${RESEND_API_BASE}/domains/${domainId}/verify`, {
    method: "POST",
    headers: authHeaders(),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json?.message ?? `Resend API error (${res.status})`)
  }
  return { success: true }
}

export async function deleteResendDomain(domainId: string): Promise<void> {
  const res = await fetch(`${RESEND_API_BASE}/domains/${domainId}`, {
    method: "DELETE",
    headers: authHeaders(),
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json?.message ?? `Resend API error (${res.status})`)
  }
}
