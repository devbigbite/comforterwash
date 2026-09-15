"use server"

// ── Record hanger count + charge for it ──────────────────────────────────
// Deliberately mirrors app/actions/weigh-in.ts's recordWeightAndCharge:
// idempotent (does nothing if hanger_charge_status is already "charged"),
// and the money math (resolveHangerPriceCents) lives in one shared place
// (lib/hanger-billing.ts) so no caller can drift from another.
//
// Called from the operator folding step (app/operator/order/[id]/folding-form.tsx)
// at the same "Mark Ready for Pickup" moment output bags get recorded — the
// first point hangers are actually known, which is almost always after the
// main weight-based charge already captured. So this always fires a
// SEPARATE charge (chargeHangerAddon in app/actions/stripe.ts), never a
// modification of the original PaymentIntent.

import { createAdminClient } from "@/lib/supabase/admin"
import { resolveHangerPriceCents } from "@/lib/hanger-billing"
import { getLocationId } from "@/lib/location"

export interface HangerResult {
  success?: boolean
  skipped?: boolean
  error?: string
  hangerChargeCents?: number
}

export async function recordHangerCountAndCharge(
  bookingId: string,
  hangerCount: number,
  enteredBy: string,
): Promise<HangerResult> {
  if (!(hangerCount > 0)) return { skipped: true } // no hangers added — nothing to do, not an error

  const supabase = createAdminClient()
  const locationId = await getLocationId()

  const { data: booking } = await supabase
    .from("bookings")
    .select("hanger_charge_status, location_id")
    .eq("id", bookingId)
    .single()

  // Same tenant-scoping guard as recordWeightAndCharge — bookingId alone
  // must never be trusted to belong to the operator's own tenant.
  if (!booking || booking.location_id !== locationId) return { error: "Order not found" }

  // Idempotent: an operator re-submitting the folding form (retry, double
  // tap) must never double-charge for hangers.
  if (booking.hanger_charge_status === "charged") return { skipped: true }

  const priceCents = await resolveHangerPriceCents()
  const hangerChargeCents = Math.round(hangerCount * priceCents)

  const { error: updateError } = await supabase.from("bookings").update({
    hanger_count: hangerCount,
    hanger_price_cents_applied: priceCents,
    hanger_charge_cents: hangerChargeCents,
    hanger_charge_status: "pending",
    hanger_entered_by: enteredBy,
    hanger_entered_at: new Date().toISOString(),
  }).eq("id", bookingId)

  if (updateError) {
    console.error("[hangers] booking update failed:", updateError.message)
    return { error: updateError.message }
  }

  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: "hangers_recorded",
    notes: `${hangerCount} hanger${hangerCount === 1 ? "" : "s"} @ $${(priceCents / 100).toFixed(2)} = $${(hangerChargeCents / 100).toFixed(2)}`,
    created_by: enteredBy,
  })

  try {
    const { chargeHangerAddon } = await import("@/app/actions/stripe")
    const result = await chargeHangerAddon(bookingId)
    if (result.error) {
      await supabase.from("order_events").insert({
        booking_id: bookingId,
        event_type: "hanger_charge_failed",
        notes: `Charge failed: ${result.error}`,
        created_by: "system",
      })
      return { error: result.error, hangerChargeCents }
    }
  } catch (e) {
    console.error("[hangers] chargeHangerAddon failed:", e)
    return { error: "Hanger charge failed", hangerChargeCents }
  }

  return { success: true, hangerChargeCents }
}
