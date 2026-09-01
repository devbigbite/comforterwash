"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"
import { getMarketingSettings } from "@/app/actions/marketing-settings"

/**
 * Grants the referring customer their bonus credit once a referred
 * customer's first booking is paid. Called from createBooking (only when
 * that booking's customer has a referred_by_customer_id, i.e. they signed
 * up using someone's referral code). Respects the monthly cap so a tenant
 * can't be walked by one person spamming their own code to friends.
 */
export async function grantReferrerCredit(params: {
  locationId: string
  referrerCustomerId: string
  bookingId: string
}): Promise<void> {
  try {
    const settings = await getMarketingSettings(params.locationId)
    if (!settings.referralEnabled || settings.referralReferrerCreditCents <= 0) return

    const supabase = createAdminClient()

    // Enforce the monthly cap — sum referrer_bonus credits already granted
    // to this customer since the start of the current calendar month.
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const { data: existingThisMonth } = await supabase
      .from("referral_credits")
      .select("amount_cents")
      .eq("customer_id", params.referrerCustomerId)
      .eq("reason", "referrer_bonus")
      .gte("created_at", monthStart.toISOString())

    const earnedThisMonth = (existingThisMonth ?? []).reduce((s, r) => s + r.amount_cents, 0)
    if (earnedThisMonth >= settings.referralMonthlyCapCents) return

    const grantCents = Math.min(settings.referralReferrerCreditCents, settings.referralMonthlyCapCents - earnedThisMonth)
    if (grantCents <= 0) return

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + settings.referralCreditExpiresDays)

    await supabase.from("referral_credits").insert({
      location_id: params.locationId,
      customer_id: params.referrerCustomerId,
      amount_cents: grantCents,
      reason: "referrer_bonus",
      related_booking_id: params.bookingId,
      expires_at: expiresAt.toISOString(),
    })
  } catch (err) {
    console.error("[referrals] grantReferrerCredit failed:", err)
  }
}

export interface ReferralStats {
  totalReferrals: number
  totalCreditGrantedCents: number
  totalCreditRedeemedCents: number
  totalCreditOutstandingCents: number
}

export async function getReferralStats(): Promise<ReferralStats> {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]

  const [{ data: referredCustomers }, { data: credits }] = await Promise.all([
    supabase.from("customers").select("id").eq("location_id", locationId).not("referred_by_customer_id", "is", null),
    supabase.from("referral_credits").select("amount_cents, redeemed").eq("location_id", locationId).eq("reason", "referrer_bonus"),
  ])

  const granted = (credits ?? []).reduce((s, c) => s + c.amount_cents, 0)
  const redeemed = (credits ?? []).filter(c => c.redeemed).reduce((s, c) => s + c.amount_cents, 0)

  return {
    totalReferrals: referredCustomers?.length ?? 0,
    totalCreditGrantedCents: granted,
    totalCreditRedeemedCents: redeemed,
    totalCreditOutstandingCents: granted - redeemed,
  }
}

/** Sum of a customer's earned, unredeemed, unexpired referral credit — what they have available to spend. */
export async function getReferralCreditBalance(customerId: string): Promise<number> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("referral_credits")
    .select("amount_cents, expires_at")
    .eq("customer_id", customerId)
    .eq("reason", "referrer_bonus")
    .eq("redeemed", false)

  const now = Date.now()
  return (data ?? [])
    .filter(r => !r.expires_at || new Date(r.expires_at).getTime() > now)
    .reduce((s, r) => s + r.amount_cents, 0)
}
