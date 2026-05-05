"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export async function createPromoCode(formData: FormData) {
  const supabase = createAdminClient()
  const discountType = formData.get("discount_type") as string
  const discountValue = parseFloat(formData.get("discount_value") as string)
  const maxUses = formData.get("max_uses") ? parseInt(formData.get("max_uses") as string) : null
  const expiresAt = formData.get("expires_at") ? new Date(formData.get("expires_at") as string).toISOString() : null

  const { error } = await supabase.from("promo_codes").insert({
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
  const supabase = createAdminClient()
  await supabase.from("promo_codes").update({ active }).eq("id", id)
  revalidatePath("/admin/promos")
}

export async function deletePromoCode(id: string) {
  const supabase = createAdminClient()
  await supabase.from("promo_codes").delete().eq("id", id)
  revalidatePath("/admin/promos")
}

// ── Called from booking forms to validate + calculate discount ────────────────
export async function validatePromoCode(code: string, serviceType: string, subtotalCents: number) {
  const supabase = createAdminClient()
  const { data: promo } = await supabase
    .from("promo_codes")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .eq("active", true)
    .single()

  if (!promo) return { valid: false, error: "Code not found or inactive." }

  // Check expiry
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return { valid: false, error: "This promo code has expired." }
  }

  // Check max uses
  if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
    return { valid: false, error: "This promo code has reached its usage limit." }
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
    discountCents,
    discountLabel: promo.discount_type === "percent"
      ? `${promo.discount_value}% off`
      : `$${(promo.discount_value).toFixed(2)} off`,
    promoId: promo.id,
    description: promo.description,
  }
}

// ── Increment uses count after successful booking ─────────────────────────────
export async function incrementPromoUses(code: string) {
  const supabase = createAdminClient()
  await supabase.rpc("increment_promo_uses", { promo_code: code }).catch(() => {
    // Fallback if RPC doesn't exist
    supabase.from("promo_codes")
      .update({ uses_count: supabase.from("promo_codes").select("uses_count") })
      .eq("code", code)
  })
}
