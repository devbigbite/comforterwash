"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { stripe } from "@/lib/stripe"
import { requireAdmin } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"

export interface FacilityPayout {
  id: string
  amount_cents: number
  period_from: string | null
  period_to: string | null
  orders_count: number | null
  total_lbs: number | null
  stripe_transfer_id: string | null
  status: string
  payment_method: string
  notes: string | null
  created_at: string
}

// Shared by issueFacilityPayout and recordManualFacilityPayment: totals the
// facility's billable work in a period so both paths store the same
// orders_count / total_lbs context alongside the amount.
async function summarizePeriod(
  supabase: ReturnType<typeof createAdminClient>,
  facilityId: string,
  periodFrom: string | null,
  periodTo: string | null,
): Promise<{ amountCents: number; ordersCount: number; totalLbs: number }> {
  if (!periodFrom || !periodTo) return { amountCents: 0, ordersCount: 0, totalLbs: 0 }

  const { data: orders } = await supabase
    .from("bookings")
    .select("id, facility_cost_cents, actual_weight_lbs")
    .eq("assigned_facility_id", facilityId)
    .in("status", ["ready_at_warehouse", "out_for_delivery", "delivered"])
    .gte("delivery_date", periodFrom)
    .lte("delivery_date", periodTo)
    .not("facility_cost_cents", "is", null)

  return {
    amountCents: (orders ?? []).reduce((s, o) => s + (o.facility_cost_cents ?? 0), 0),
    ordersCount: (orders ?? []).length,
    totalLbs:    (orders ?? []).reduce((s, o) => s + (o.actual_weight_lbs ?? 0), 0),
  }
}

// Parses a dollars-and-cents form field ("112.10", "$112.10", "1,120") into
// integer cents. Returns null for blank/garbage input so callers can tell
// "left empty on purpose" apart from "typed a zero".
function parseDollarsToCents(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string") return null
  const cleaned = raw.replace(/[$,\s]/g, "").trim()
  if (!cleaned) return null
  const dollars = Number(cleaned)
  if (!Number.isFinite(dollars)) return null
  return Math.round(dollars * 100)
}

// ── Create / resume Stripe Express account for a facility ─────────────────────
// Called from the partner portal (code-gated, not admin-gated)
export async function createFacilityStripeAccount(
  facilityId: string,
  facilityCode: string,
): Promise<{ url?: string; error?: string }> {
  const supabase = createAdminClient()

  const { data: facility } = await supabase
    .from("facilities")
    .select("id, name, contact_email, stripe_account_id, partner_access_code")
    .eq("id", facilityId)
    .eq("partner_access_code", facilityCode)
    .single()

  if (!facility) return { error: "Facility not found" }

  let accountId = facility.stripe_account_id

  if (!accountId) {
    const account = await stripe.accounts.create({
      controller: {
        stripe_dashboard: { type: "express" },
        fees:             { payer: "application" },
        losses:           { payments: "application" },
      },
      email:         facility.contact_email ?? undefined,
      capabilities: { transfers: { requested: true } },
      business_type: "company",
      settings: {
        payouts: { schedule: { interval: "weekly", weekly_anchor: "friday" } },
      },
    })
    accountId = account.id

    await supabase
      .from("facilities")
      .update({ stripe_account_id: accountId })
      .eq("id", facilityId)
  }

  // Stripe rejects account-link URLs that aren't HTTPS on a live-mode
  // request ("Livemode requests must always be redirected via HTTPS") — the
  // old localhost fallback here (unlike every other NEXT_PUBLIC_SITE_URL
  // fallback in this codebase, which already defaults to the real domain)
  // silently broke this specific flow the moment account creation started
  // succeeding, since it never got this far before.
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://comforterwash.com"
  const link = await stripe.accountLinks.create({
    account:     accountId,
    refresh_url: `${origin}/partner/${facilityCode}?stripe_refresh=1`,
    return_url:  `${origin}/partner/${facilityCode}?stripe_return=1`,
    type:        "account_onboarding",
  })

  return { url: link.url }
}

// ── Sync onboarding status from Stripe ───────────────────────────────────────
// Core logic shared by both an admin-gated caller (admin/facilities, staff
// manually refreshing a facility's status) and a code-gated caller (the
// public partner portal, auto-syncing the instant a facility partner
// returns from Stripe onboarding). Neither wrapper below skips its own
// auth check — this just avoids duplicating the actual Stripe call/DB write.
async function syncFacilityStripeStatusCore(
  facilityId: string,
): Promise<{ complete?: boolean; error?: string }> {
  const supabase = createAdminClient()
  const { data: facility } = await supabase
    .from("facilities")
    .select("stripe_account_id")
    .eq("id", facilityId)
    .single()

  if (!facility?.stripe_account_id) return { error: "No Stripe account linked" }

  const account = await stripe.accounts.retrieve(facility.stripe_account_id)
  const complete =
    !!account.details_submitted &&
    !(account.requirements?.currently_due?.length)

  await supabase
    .from("facilities")
    .update({ stripe_onboarding_complete: complete })
    .eq("id", facilityId)

  revalidatePath("/admin/facilities")
  return { complete }
}

// Admin-gated — used from /admin/facilities.
export async function syncFacilityStripeStatus(
  facilityId: string,
): Promise<{ complete?: boolean; error?: string }> {
  await requireAdmin()
  return syncFacilityStripeStatusCore(facilityId)
}

// Code-gated (not admin-gated) — used from the public /partner/[code] portal,
// same trust model as createFacilityStripeAccount above: the facility's own
// access code stands in for admin auth here, since the person hitting this
// page is the facility partner, not platform staff. Previously this call
// site used the admin-gated function above, which threw "Unauthorized:
// admin access required" and crashed the entire page the instant a facility
// partner returned from Stripe's onboarding flow.
export async function syncFacilityStripeStatusPublic(
  facilityId: string,
  facilityCode: string,
): Promise<{ complete?: boolean; error?: string }> {
  const supabase = createAdminClient()
  const { data: facility } = await supabase
    .from("facilities")
    .select("id")
    .eq("id", facilityId)
    .eq("partner_access_code", facilityCode)
    .single()

  if (!facility) return { error: "Facility not found" }
  return syncFacilityStripeStatusCore(facilityId)
}

// ── Issue payout to facility ──────────────────────────────────────────────────
export async function issueFacilityPayout(
  formData: FormData,
): Promise<{ success?: boolean; amountCents?: number; error?: string }> {
  await requireAdmin()

  const supabase = createAdminClient()
  const facilityId  = formData.get("facilityId") as string
  const periodFrom  = formData.get("period_from") as string
  const periodTo    = formData.get("period_to") as string
  const notes       = (formData.get("notes") as string)?.trim() || null

  const { data: facility } = await supabase
    .from("facilities")
    .select("stripe_account_id, stripe_onboarding_complete, location_id")
    .eq("id", facilityId)
    .single()

  if (!facility?.stripe_account_id)   return { error: "No Stripe Connect account linked" }
  if (!facility.stripe_onboarding_complete) return { error: "Facility has not completed Stripe onboarding" }

  // Sum facility_cost_cents for completed orders in the period
  const { amountCents: computedCents, ordersCount, totalLbs } =
    await summarizePeriod(supabase, facilityId, periodFrom, periodTo)

  // An optional override lets staff pay a figure that differs from what the
  // orders add up to — a negotiated adjustment, a correction for a prior
  // period, a partial payment. When it's blank we pay the computed total,
  // which is the normal case.
  const overrideCents = parseDollarsToCents(formData.get("amount_override"))
  if (overrideCents !== null && overrideCents <= 0) {
    return { error: "Override amount must be greater than $0." }
  }
  const amountCents = overrideCents ?? computedCents

  if (amountCents <= 0) return { error: "No billable orders found in this period." }

  // Record the discrepancy in the notes rather than silently storing an
  // amount that doesn't reconcile against orders_count / total_lbs.
  const overrideNote = overrideCents !== null && overrideCents !== computedCents
    ? `Manual amount override: $${(overrideCents / 100).toFixed(2)} (orders totalled $${(computedCents / 100).toFixed(2)})`
    : null
  const finalNotes = [notes, overrideNote].filter(Boolean).join(" — ") || null

  const transfer = await stripe.transfers.create({
    amount:      amountCents,
    currency:    "usd",
    destination: facility.stripe_account_id,
    description: `WashFold facility payout ${periodFrom} – ${periodTo} (${ordersCount} orders, ${totalLbs.toFixed(1)} lbs)`,
  })

  await supabase.from("facility_payouts").insert({
    facility_id:        facilityId,
    location_id:        facility.location_id ?? null,
    amount_cents:       amountCents,
    stripe_transfer_id: transfer.id,
    period_from:        periodFrom,
    period_to:          periodTo,
    orders_count:       ordersCount,
    total_lbs:          totalLbs,
    status:             "transferred",
    payment_method:     "stripe",
    notes:              finalNotes,
    created_by:         "admin",
  })

  revalidatePath("/admin/facilities")
  return { success: true, amountCents }
}

// ── Record a payment made outside Stripe ─────────────────────────────────────
// For facilities we pay by cash, check or bank transfer — including ones that
// never connected a Stripe account. This moves no money; it only writes the
// ledger row so /admin/facilities and the partner's Payments tab reflect
// reality. Deliberately does NOT require stripe_onboarding_complete.
export async function recordManualFacilityPayment(
  formData: FormData,
): Promise<{ success?: boolean; amountCents?: number; error?: string }> {
  await requireAdmin()

  const supabase   = createAdminClient()
  const facilityId = formData.get("facilityId") as string
  const periodFrom = (formData.get("period_from") as string) || null
  const periodTo   = (formData.get("period_to")   as string) || null
  const method     = ((formData.get("payment_method") as string) || "other").trim()
  const notes      = (formData.get("notes") as string)?.trim() || null
  const reference  = (formData.get("reference") as string)?.trim() || null

  if (!facilityId) return { error: "Missing facility" }

  const amountCents = parseDollarsToCents(formData.get("amount"))
  if (amountCents === null)  return { error: "Enter the amount you paid." }
  if (amountCents <= 0)      return { error: "Amount must be greater than $0." }

  const { data: facility } = await supabase
    .from("facilities")
    .select("id, location_id")
    .eq("id", facilityId)
    .single()

  if (!facility) return { error: "Facility not found" }

  // Period is optional here — a cash payment may not map to a clean date
  // range. When one is given we still attach the order context so the row
  // reads the same as a Stripe payout in both UIs.
  const { ordersCount, totalLbs } = await summarizePeriod(supabase, facilityId, periodFrom, periodTo)

  const noteParts = [
    reference ? `Ref: ${reference}` : null,
    notes,
  ].filter(Boolean)

  const { error } = await supabase.from("facility_payouts").insert({
    facility_id:        facilityId,
    location_id:        facility.location_id ?? null,
    amount_cents:       amountCents,
    stripe_transfer_id: null,
    period_from:        periodFrom,
    period_to:          periodTo,
    orders_count:       periodFrom && periodTo ? ordersCount : null,
    total_lbs:          periodFrom && periodTo ? totalLbs    : null,
    status:             "paid",
    payment_method:     method,
    notes:              noteParts.join(" — ") || null,
    created_by:         "admin",
  })

  if (error) {
    console.error("[facility-payments] manual payment insert failed:", error.message)
    return { error: error.message }
  }

  revalidatePath("/admin/facilities")
  return { success: true, amountCents }
}

// ── Get payout history for a facility ────────────────────────────────────────
export async function getFacilityPayouts(facilityId: string): Promise<FacilityPayout[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("facility_payouts")
    .select("id, amount_cents, period_from, period_to, orders_count, total_lbs, stripe_transfer_id, status, payment_method, notes, created_at")
    .eq("facility_id", facilityId)
    .order("created_at", { ascending: false })
    .limit(24)
  return (data ?? []) as FacilityPayout[]
}
