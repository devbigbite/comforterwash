"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"
import { getMarketingSettings } from "@/app/actions/marketing-settings"

export async function createPromoCode(formData: FormData) {
  await requireAdmin()

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const discountType = formData.get("discount_type") as string
  const discountValue = parseFloat(formData.get("discount_value") as string)
  const maxUses = formData.get("max_uses") ? parseInt(formData.get("max_uses") as string) : null
  const expiresAt = formData.get("expires_at") ? new Date(formData.get("expires_at") as string).toISOString() : null

  const { error } = await supabase.from("promo_codes").insert({
    location_id:    locationId,
    code:           (formData.get("code") as string).toUpperCase().trim(),
    description:    formData.get("description") as string,
    discount_type:  discountType,
    discount_value: discountValue,
    applies_to:     formData.get("applies_to") as string ?? "all",
    max_uses:       maxUses,
    expires_at:     expiresAt,
    active:         true,
  })

  if (error) return { error: error.code === "23505" ? "That code already exists." : error.message }
  revalidatePath("/admin/promos")
  return { success: true }
}

export async function togglePromoCode(id: string, active: boolean) {
  await requireAdmin()

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("promo_codes").update({ active }).eq("id", id).eq("location_id", locationId)
  revalidatePath("/admin/promos")
}

export async function deletePromoCode(id: string) {
  await requireAdmin()

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("promo_codes").delete().eq("id", id).eq("location_id", locationId)
  revalidatePath("/admin/promos")
}

// ── Called from booking forms to validate + calculate discount ────────────────
// customerEmail/customerPhone identify the customer so a "one per customer"
// code (e.g. WASHFOLD1/WASHFOLD2 — 30% off a customer's 1st/2nd order) can
// actually enforce that per-customer, not globally. Both are optional so
// this still works at whatever point in a booking form the promo field
// happens to render (some forms collect contact info in a later step) —
// without at least one, the per-customer check is skipped and only the
// promo's own max_uses (if any) applies.
export async function validatePromoCode(
  code: string,
  serviceType: string,
  subtotalCents: number,
  customerEmail?: string | null,
  customerPhone?: string | null,
) {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data: promo } = await supabase
    .from("promo_codes")
    .select("*")
    .eq("location_id", locationId)
    .eq("code", code.toUpperCase().trim())
    .eq("active", true)
    .single()

  if (!promo) {
    // Not a promo code -- check whether it's a customer's referral code
    // instead. Referral codes are validated the same way a promo would be:
    // same input field on the booking form, same discount mechanics. The
    // referrer's own bonus credit is granted separately, after the referred
    // booking is actually paid (see grantReferrerCredit, called from
    // createBooking) -- not here, since this call doesn't create a booking.
    const referral = await validateReferralCode(code, locationId, subtotalCents, customerEmail)
    if (referral) return referral
    return { valid: false, error: "Code not found or inactive." }
  }

  // Check expiry
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return { valid: false, error: "This promo code has expired." }
  }

  // Global usage cap, if the promo has one (rare — most "1st/2nd order"
  // style codes should leave this unset now that per-customer redemption
  // tracking below enforces the real limit; a global max_uses=1 previously
  // meant the FIRST customer to redeem it silently locked out every other
  // customer, which is what happened here).
  if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
    return { valid: false, error: "This promo code has reached its usage limit." }
  }

  // Per-customer usage check — has this specific customer (by email or
  // phone, whichever was provided) already redeemed this exact code?
  if (customerEmail || customerPhone) {
    let redemptionQuery = supabase
      .from("promo_code_redemptions")
      .select("id")
      .eq("promo_code_id", promo.id)
      .limit(1)

    if (customerEmail && customerPhone) {
      redemptionQuery = redemptionQuery.or(
        `customer_email.ilike.${customerEmail.trim()},customer_phone.eq.${customerPhone.trim()}`
      )
    } else if (customerEmail) {
      redemptionQuery = redemptionQuery.ilike("customer_email", customerEmail.trim())
    } else if (customerPhone) {
      redemptionQuery = redemptionQuery.eq("customer_phone", customerPhone!.trim())
    }

    const { data: priorRedemption } = await redemptionQuery.maybeSingle()
    if (priorRedemption) {
      return { valid: false, error: "You've already used this code." }
    }
  }

  // Check service type restriction
  if (promo.applies_to !== "all" && promo.applies_to !== serviceType) {
    return { valid: false, error: `This code only applies to ${promo.applies_to.replace("_", " ")} orders.` }
  }

  // Calculate discount
  let discountCents = 0
  if (promo.discount_type === "percent") {
    discountCents = Math.round(subtotalCents * (promo.discount_value / 100))
  } else {
    discountCents = Math.round(promo.discount_value * 100) // stored as dollar value
  }
  discountCents = Math.min(discountCents, subtotalCents) // can't discount more than total

  return {
    valid: true,
    error: undefined,
    discountCents,
    discountLabel: promo.discount_type === "percent"
      ? `${promo.discount_value}% off`
      : `$${(promo.discount_value).toFixed(2)} off`,
    promoId: promo.id,
    description: promo.description,
    isReferralCode: false,
  }
}

// ── Record a redemption after a booking is actually created ───────────────────
// Called from createBooking() (app/actions/bookings.ts) whenever data.promoCode
// is set — this is the real enforcement point for per-customer limits (see
// validatePromoCode above): a row here is what a future validatePromoCode call
// for the same customer + code will find and reject on. Also still bumps
// promo_codes.uses_count for the admin's own visibility/reporting, but that
// count is no longer what's used to decide whether a code can be used again.
//
// NOTE: the previous version of this function (incrementPromoUses) was never
// actually called from anywhere in the codebase — promo usage was tracked in
// name only. That's a separate reason WASHFOLD1/WASHFOLD2 showed 0 uses even
// if they'd been redeemed.
export async function recordPromoRedemption(params: {
  code: string
  customerEmail?: string | null
  customerPhone?: string | null
  bookingId: string
  locationId: string
}) {
  const supabase = createAdminClient()
  const normalizedCode = params.code.toUpperCase().trim()

  const { data: promo } = await supabase
    .from("promo_codes")
    .select("id, uses_count")
    .eq("location_id", params.locationId)
    .eq("code", normalizedCode)
    .maybeSingle()

  if (!promo) {
    console.error(`[promos] recordPromoRedemption: no promo_codes row for code "${normalizedCode}" — booking ${params.bookingId} kept its discount but no redemption was recorded`)
    return
  }

  await supabase.from("promo_code_redemptions").insert({
    promo_code_id: promo.id,
    location_id: params.locationId,
    code: normalizedCode,
    customer_email: params.customerEmail?.trim() || null,
    customer_phone: params.customerPhone?.trim() || null,
    booking_id: params.bookingId,
  })

  await supabase
    .from("promo_codes")
    .update({ uses_count: (promo.uses_count ?? 0) + 1 })
    .eq("id", promo.id)
}


// ── Referral code fallback for validatePromoCode ───────────────────────────
async function validateReferralCode(
  code: string,
  locationId: string,
  subtotalCents: number,
  customerEmail?: string | null,
) {
  const settings = await getMarketingSettings(locationId)
  if (!settings.referralEnabled) return null

  const supabase = createAdminClient()
  const normalized = code.toUpperCase().trim()

  const { data: referrer } = await supabase
    .from("customers")
    .select("id, email")
    .eq("location_id", locationId)
    .eq("referral_code", normalized)
    .maybeSingle()

  if (!referrer) return null
  if (customerEmail && referrer.email && referrer.email.toLowerCase() === customerEmail.toLowerCase()) {
    return { valid: false, error: "You can't use your own referral code." }
  }

  const discountCents = Math.min(settings.referralRefereeCreditCents, subtotalCents)
  return {
    valid: true,
    error: undefined,
    discountCents,
    discountLabel: `$${(discountCents / 100).toFixed(2)} off (referral)`,
    promoId: null,
    description: "Referral discount",
    isReferralCode: true,
  }
}
