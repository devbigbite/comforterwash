"use server"

// ── Shared weigh-in + billing logic ──────────────────────────────────────────
// Extracted from operator/order/[id]/page.tsx's advanceOrder (which used to
// have this inlined) so there's exactly one place that turns a scale reading
// into a real customer charge — commercial account billing, consumer capture,
// and subscription off-session charges all funnel through here. The operator
// station's "advance to washer" step and the admin order page's standalone
// weight-entry card both call this same function; neither duplicates the
// pricing math or the charge dispatch logic.
//
// Deliberately idempotent: does nothing (returns skipped:true) if the booking
// already has actual_weight_lbs set, so calling this twice — e.g. an operator
// and an admin both trying to enter weight on the same order — never
// overwrites an existing weight or double-charges the customer.

import { createAdminClient } from "@/lib/supabase/admin"

export interface WeighInResult {
  success?: boolean
  skipped?: boolean
  error?: string
  customerFinalCents?: number
  facilityCostCents?: number
}

export async function recordWeightAndCharge(
  bookingId: string,
  weightLbs: number,
  enteredBy: string,
): Promise<WeighInResult> {
  if (!(weightLbs > 0)) return { error: "Enter a weight greater than 0 lbs" }

  const supabase = createAdminClient()

  const { data: booking } = await supabase
    .from("bookings")
    .select("actual_weight_lbs, assigned_facility_id, stripe_payment_intent_id, customer_final_cents, service_type, commercial_account_id, recurring_subscription_id")
    .eq("id", bookingId)
    .single()

  if (!booking) return { error: "Order not found" }
  if (booking.actual_weight_lbs) return { skipped: true, customerFinalCents: booking.customer_final_cents ?? undefined }

  // Commercial pay-at-time-of-service accounts price off their own
  // negotiated rate_type/rate_amount_cents/minimum_amount_cents instead of
  // the consumer DEFAULT_RATE table — see commercial_accounts.
  let commercialAccount: { rate_type: string; rate_amount_cents: number | null; minimum_amount_cents: number | null } | null = null
  if (booking.commercial_account_id) {
    const { data } = await supabase
      .from("commercial_accounts")
      .select("rate_type, rate_amount_cents, minimum_amount_cents")
      .eq("id", booking.commercial_account_id)
      .single()
    commercialAccount = data
  }

  let customerFinalCents: number
  if (commercialAccount) {
    const rateAmount = commercialAccount.rate_amount_cents ?? 0
    const rawCents =
      commercialAccount.rate_type === "per_lb" ? Math.round(weightLbs * rateAmount) :
      commercialAccount.rate_type === "flat" ? rateAmount :
      rateAmount // per_load — same flat amount per order
    customerFinalCents = Math.max(rawCents, commercialAccount.minimum_amount_cents ?? 0)
  } else {
    const DEFAULT_RATE: Record<string, number> = { wash_fold: 250, wash_only: 199, comforter_wash: 0 }
    const ratePerLbCents = DEFAULT_RATE[booking.service_type as string] ?? 250
    const customerChargeLbs = Math.max(weightLbs, 20)
    customerFinalCents = customerChargeLbs * ratePerLbCents
  }

  let facilityCostCents = 0
  if (booking.assigned_facility_id) {
    const { data: facility } = await supabase
      .from("facilities").select("rate_per_lb, minimum_lbs").eq("id", booking.assigned_facility_id).single()
    if (facility?.rate_per_lb) {
      facilityCostCents = Math.round(Math.max(weightLbs, facility.minimum_lbs ?? 0) * facility.rate_per_lb * 100)
    }
  }

  const { error: updateError } = await supabase.from("bookings").update({
    actual_weight_lbs: weightLbs,
    customer_final_cents: customerFinalCents,
    facility_cost_cents: facilityCostCents,
    weight_entered_by: enteredBy,
    weight_entered_at: new Date().toISOString(),
  }).eq("id", bookingId)

  if (updateError) {
    console.error("[weigh-in] booking update failed:", updateError.message)
    return { error: updateError.message }
  }

  if (booking.commercial_account_id && customerFinalCents) {
    try {
      const { chargeCommercialAccountOrder } = await import("@/app/actions/stripe")
      const result = await chargeCommercialAccountOrder(bookingId)
      if (result.error) {
        await supabase.from("order_events").insert({
          booking_id: bookingId,
          event_type: "commercial_charge_failed",
          notes: `Charge failed: ${result.error}`,
          created_by: "system",
        })
      }
    } catch (e) { console.error("[weigh-in] Commercial charge failed:", e) }
  } else if (booking.stripe_payment_intent_id && customerFinalCents) {
    try {
      const { capturePayment } = await import("@/app/actions/stripe")
      await capturePayment(bookingId)
    } catch (e) { console.error("[weigh-in] Stripe capture failed:", e) }
  } else if (booking.recurring_subscription_id && customerFinalCents) {
    // Auto-generated recurring subscription pickup (2nd+ pickup) — no
    // pre-auth exists, so charge the subscriber's saved card off-session.
    try {
      const { chargeSubscriptionOrder } = await import("@/app/actions/stripe")
      const result = await chargeSubscriptionOrder(bookingId)
      if (result.error) {
        await supabase.from("order_events").insert({
          booking_id: bookingId,
          event_type: "subscription_charge_failed",
          notes: `Charge failed: ${result.error}`,
          created_by: "system",
        })
      }
    } catch (e) { console.error("[weigh-in] Subscription charge failed:", e) }
  }

  return { success: true, customerFinalCents, facilityCostCents }
}
