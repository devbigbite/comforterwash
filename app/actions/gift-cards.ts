"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"
import { sendGiftCardEmail } from "@/lib/email"

export interface GiftCard {
  id: string
  code: string
  initial_amount_cents: number
  balance_cents: number
  purchaser_name: string | null
  purchaser_email: string | null
  recipient_name: string | null
  recipient_email: string | null
  message: string | null
  status: "active" | "redeemed" | "cancelled"
  created_at: string
}

function generateGiftCardCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no O/0/I/1 confusion
  const block = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
  return `${block()}-${block()}`
}

// ── Called from handleSuccessfulPayment right after a gift-card purchase's
// Stripe session completes. Retries the code on a (very unlikely) collision
// with the per-location unique index. ─────────────────────────────────────
export async function createGiftCardFromPurchase(params: {
  amountCents: number
  purchaserName?: string
  purchaserEmail?: string
  recipientName?: string
  recipientEmail?: string
  message?: string
  stripeCheckoutSessionId: string
}): Promise<{ code: string } | { error: string }> {
  const supabase = createAdminClient()
  const locationId = await getLocationId()

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateGiftCardCode()
    const { error } = await supabase.from("gift_cards").insert({
      location_id: locationId,
      code,
      initial_amount_cents: params.amountCents,
      balance_cents: params.amountCents,
      purchaser_name: params.purchaserName || null,
      purchaser_email: params.purchaserEmail || null,
      recipient_name: params.recipientName || null,
      recipient_email: params.recipientEmail || null,
      message: params.message || null,
      stripe_checkout_session_id: params.stripeCheckoutSessionId,
    })

    if (!error) {
      // Best-effort delivery email — to the recipient if given, otherwise
      // back to the purchaser to forward themselves.
      sendGiftCardEmail({
        toEmail: params.recipientEmail || params.purchaserEmail || "",
        recipientName: params.recipientName,
        purchaserName: params.purchaserName,
        amountCents: params.amountCents,
        code,
        message: params.message,
      }).catch(err => console.error("[gift-cards] sendGiftCardEmail failed:", err))

      return { code }
    }
    if (error.code !== "23505") return { error: error.message } // not a collision — bail
    // else: code collision, loop and try a new one
  }
  return { error: "Could not generate a unique gift card code — please try again." }
}

// ── Called from booking forms to check a code before applying it as a discount.
// Does NOT touch the balance — that only happens after payment succeeds,
// via redeemGiftCard below, mirroring how promo codes work. ────────────────
export async function validateGiftCard(code: string, subtotalCents: number) {
  const supabase = createAdminClient()
  const locationId = await getLocationId()
  const { data: card } = await supabase
    .from("gift_cards")
    .select("*")
    .eq("location_id", locationId)
    .eq("code", code.toUpperCase().trim())
    .maybeSingle()

  if (!card) return { valid: false, error: "Gift card not found." }
  if (card.status === "cancelled") return { valid: false, error: "This gift card has been cancelled." }
  if (card.balance_cents <= 0) return { valid: false, error: "This gift card has no remaining balance." }

  const discountCents = Math.min(card.balance_cents, subtotalCents)
  return {
    valid: true,
    discountCents,
    remainingBalanceCents: card.balance_cents - discountCents,
    code: card.code,
  }
}

// ── Called once a booking that used a gift card has actually been paid for.
// Decrements the balance, logs the redemption, and marks the card fully
// redeemed once its balance hits zero. ─────────────────────────────────────
export async function redeemGiftCard(code: string, amountCents: number, bookingId?: string) {
  const supabase = createAdminClient()
  const locationId = await getLocationId()

  const { data: card } = await supabase
    .from("gift_cards")
    .select("id, balance_cents")
    .eq("location_id", locationId)
    .eq("code", code.toUpperCase().trim())
    .maybeSingle()

  if (!card) return { error: "Gift card not found." }

  const amount = Math.min(amountCents, card.balance_cents)
  const newBalance = card.balance_cents - amount

  await supabase.from("gift_cards").update({
    balance_cents: newBalance,
    status: newBalance <= 0 ? "redeemed" : "active",
    updated_at: new Date().toISOString(),
  }).eq("id", card.id)

  await supabase.from("gift_card_redemptions").insert({
    gift_card_id: card.id,
    booking_id: bookingId ?? null,
    amount_cents: amount,
  })

  return { success: true, remainingBalanceCents: newBalance }
}

// ── Admin: list all gift cards issued for this tenant ──────────────────────
export async function getGiftCards(): Promise<GiftCard[]> {
  await requireAdmin()
  const supabase = createAdminClient()
  const locationId = await getLocationId()
  const { data } = await supabase
    .from("gift_cards")
    .select("*")
    .eq("location_id", locationId)
    .order("created_at", { ascending: false })
  return (data ?? []) as GiftCard[]
}
