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
import { sendSMS, sendBookingNotification } from "@/lib/sms"
import { sendWeightConfirmedEmail } from "@/lib/email"

export interface WeighInResult {
  success?: boolean
  skipped?: boolean
  error?: string
  customerFinalCents?: number
  facilityCostCents?: number
}

export const CUSTOMER_MIN_LBS = 20
// Fallback only — used when a booking has no locked-in price_per_lb_cents
// (shouldn't normally happen for a real consumer booking; kept as a safety
// net so weighing never hard-fails on a data gap). Keep this in sync with
// the live settings-table rates (wash_fold_one_time_cents, etc. — see
// app/actions/pricing.ts) whenever pricing changes; a stale value here only
// bites the rare booking that reaches weigh-in with no locked-in rate, but
// when it does it silently undercharges (this is what happened on order
// 714600: price_per_lb_cents was null, so this fallback billed $2.50/lb
// instead of the real $2.55/lb rate).
export const DEFAULT_RATE_CENTS: Record<string, number> = { wash_fold: 255, wash_only: 199, comforter_wash: 0 }

export async function recordWeightAndCharge(
  bookingId: string,
  weightLbs: number,
  enteredBy: string,
  // Optional per-bag breakdown (bag id -> lbs), captured at the same weigh-in
  // moment the total is entered. Purely informational/display — billing math
  // above only ever uses the total `weightLbs`, so a missing or partial
  // breakdown never affects what the customer is charged.
  bagWeights?: { bagId: string; weightLbs: number }[],
): Promise<WeighInResult> {
  if (!(weightLbs > 0)) return { error: "Enter a weight greater than 0 lbs" }

  const supabase = createAdminClient()

  const { data: booking } = await supabase
    .from("bookings")
    .select("actual_weight_lbs, assigned_facility_id, stripe_payment_intent_id, customer_final_cents, service_type, commercial_account_id, recurring_subscription_id, price_per_lb_cents, short_code, customer_name, customer_email, customer_phone")
    .eq("id", bookingId)
    .single()

  if (!booking) return { error: "Order not found" }
  if (booking.actual_weight_lbs) return { skipped: true, customerFinalCents: booking.customer_final_cents ?? undefined }

  // Commercial pay-at-time-of-service accounts price off their own
  // negotiated rate_type/rate_amount_cents/minimum_amount_cents instead of
  // the consumer per-lb rate — see commercial_accounts.
  let commercialAccount: { rate_type: string; rate_amount_cents: number | null; minimum_amount_cents: number | null; business_name?: string } | null = null
  if (booking.commercial_account_id) {
    const { data } = await supabase
      .from("commercial_accounts")
      .select("rate_type, rate_amount_cents, minimum_amount_cents")
      .eq("id", booking.commercial_account_id)
      .single()
    commercialAccount = data
  }

  let customerFinalCents: number
  // Consumer rate: this booking's own locked-in price_per_lb_cents (set at
  // checkout time — e.g. a customer quoted $2.69/lb should always be billed
  // $2.69/lb, not a generic default) takes priority over DEFAULT_RATE_CENTS.
  // Previously this function ignored price_per_lb_cents entirely, so weight
  // entered from the admin/operator weigh-in card could silently undercharge
  // (or overcharge) a customer relative to what the driver-app path
  // (confirmDropoff, which did read this field) would have billed for the
  // exact same order.
  const consumerRateCents = booking.price_per_lb_cents ?? DEFAULT_RATE_CENTS[booking.service_type as string] ?? 250
  const chargedLbs = Math.max(weightLbs, CUSTOMER_MIN_LBS)
  if (commercialAccount) {
    const rateAmount = commercialAccount.rate_amount_cents ?? 0
    const rawCents =
      commercialAccount.rate_type === "per_lb" ? Math.round(weightLbs * rateAmount) :
      commercialAccount.rate_type === "flat" ? rateAmount :
      rateAmount // per_load — same flat amount per order
    customerFinalCents = Math.max(rawCents, commercialAccount.minimum_amount_cents ?? 0)
  } else {
    customerFinalCents = chargedLbs * consumerRateCents
  }

  let facilityCostCents = 0
  if (booking.assigned_facility_id) {
    const { data: facility } = await supabase
      .from("facilities").select("rate_per_lb, minimum_lbs").eq("id", booking.assigned_facility_id).single()
    if (facility?.rate_per_lb) {
      // Whenever an order is light enough that the customer gets billed the
      // CUSTOMER_MIN_LBS minimum instead of their actual weight, the facility
      // that processed it must be paid for that same minimum too — not just
      // whatever lower weight actually came off the scale. A facility's own
      // minimum_lbs (its separate contractual floor, e.g. a facility that
      // requires 30 lbs minimum regardless of what we bill customers) can
      // still raise this further, but must never be allowed to silently
      // undercut the customer minimum — that was the bug here: this facility
      // has minimum_lbs = 0, so a sub-20lb order paid the facility only for
      // the real weight while the customer was charged for a full 20 lbs.
      const facilityBillableLbs = Math.max(weightLbs, facility.minimum_lbs ?? 0, CUSTOMER_MIN_LBS)
      facilityCostCents = Math.round(facilityBillableLbs * facility.rate_per_lb * 100)
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

  if (bagWeights?.length) {
    // Best-effort — a failure here should never undo the weight/billing
    // update above, which has already succeeded and (for commercial/consumer
    // charges below) is about to trigger a real charge.
    for (const { bagId, weightLbs: lbs } of bagWeights) {
      if (!(lbs > 0)) continue
      const { error } = await supabase.from("order_bags").update({ weight_lbs: lbs }).eq("id", bagId).eq("booking_id", bookingId)
      if (error) console.error("[weigh-in] per-bag weight save failed:", bagId, error.message)
    }
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

  // Tell the customer their order was weighed — fire-and-forget so a
  // notification failure never blocks the (already-committed) weight/
  // billing save. Deliberately no pricing in these messages per explicit
  // request — just a warm thank-you + the weight. Billing itself is still
  // computed and charged as normal above; customers can see the full
  // amount on their card statement or by tracking the order.
  try {
    if (commercialAccount) {
      if (booking.customer_phone) {
        await sendSMS(booking.customer_phone,
          `Hi ${booking.customer_name?.split(" ")[0] ?? "there"}, thank you for your order! 🧺 It weighed in at ${weightLbs} lbs. We appreciate your business!`)
      }
    } else {
      if (booking.customer_phone) {
        await sendBookingNotification(bookingId, "weight_confirmed",
          booking.customer_name?.split(" ")[0] ?? "there", String(weightLbs))
      }
      if (booking.customer_email) {
        await sendWeightConfirmedEmail(booking.customer_email, {
          customerName: booking.customer_name ?? "Valued Customer",
          shortCode: booking.short_code,
          weightLbs,
        })
      }
    }
  } catch (e) { console.error("[weigh-in] Weight-confirmed notification failed:", e) }

  return { success: true, customerFinalCents, facilityCostCents }
}
