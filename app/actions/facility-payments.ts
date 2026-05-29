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
  notes: string | null
  created_at: string
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
      type: "express",
      email: facility.contact_email ?? undefined,
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

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  const link = await stripe.accountLinks.create({
    account:     accountId,
    refresh_url: `${origin}/partner/${facilityCode}?stripe_refresh=1`,
    return_url:  `${origin}/partner/${facilityCode}?stripe_return=1`,
    type:        "account_onboarding",
  })

  return { url: link.url }
}

// ── Sync onboarding status from Stripe ───────────────────────────────────────
export async function syncFacilityStripeStatus(
  facilityId: string,
): Promise<{ complete?: boolean; error?: string }> {
  await requireAdmin()

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
  const { data: orders } = await supabase
    .from("bookings")
    .select("id, facility_cost_cents, actual_weight_lbs")
    .eq("assigned_facility_id", facilityId)
    .in("status", ["ready_at_warehouse", "out_for_delivery", "delivered"])
    .gte("delivery_date", periodFrom)
    .lte("delivery_date", periodTo)
    .not("facility_cost_cents", "is", null)

  const amountCents = (orders ?? []).reduce((s, o) => s + (o.facility_cost_cents ?? 0), 0)
  if (amountCents <= 0) return { error: "No billable orders found in this period." }

  const totalLbs    = (orders ?? []).reduce((s, o) => s + (o.actual_weight_lbs ?? 0), 0)
  const ordersCount = (orders ?? []).length

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
    notes,
    created_by:         "admin",
  })

  revalidatePath("/admin/facilities")
  return { success: true, amountCents }
}

// ── Get payout history for a facility ────────────────────────────────────────
export async function getFacilityPayouts(facilityId: string): Promise<FacilityPayout[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("facility_payouts")
    .select("id, amount_cents, period_from, period_to, orders_count, total_lbs, stripe_transfer_id, status, notes, created_at")
    .eq("facility_id", facilityId)
    .order("created_at", { ascending: false })
    .limit(24)
  return (data ?? []) as FacilityPayout[]
}
