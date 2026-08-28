// ── Shared order billing math ────────────────────────────────────────
// One place that turns a scale reading into the two money figures every
// downstream screen depends on: what the customer owes (customer_final_cents)
// and what we owe the facility that processed it (facility_cost_cents).
//
// This exists because the driver app's confirmDropoff and the admin/operator
// weigh-in (app/actions/weigh-in.ts) each carried their own copy of this math
// and had already drifted apart. The driver copy ignored commercial account
// rates entirely (billing a negotiated account at the consumer per-lb rate)
// and never computed facility cost at all — which left facility_cost_cents
// NULL and made the admin order page show "Billing pending — weight not yet
// entered" on an order that had been weighed three days earlier (order
// 714600). Both callers now share this function so they cannot diverge again.

import type { createAdminClient } from "@/lib/supabase/admin"
import { DEFAULT_RATE_CENTS } from "@/lib/pricing-constants"
import { resolveMinLbs } from "@/lib/order-minimum"

// Typed off the service-role client every caller already uses, rather than a
// hand-rolled structural shape — Postgrest's builders are PromiseLike rather
// than Promise, so a hand-rolled shape quietly fails to accept the real
// client. This function only ever reads; it never writes.
type AdminClient = ReturnType<typeof createAdminClient>

// The negotiated terms on commercial_accounts. Named rather than inlined so
// the cast below has something concrete to widen to (an inline `typeof`
// self-reference collapses to `never` under narrowing).
interface CommercialRate {
  rate_type?: string
  rate_amount_cents?: number | null
  minimum_amount_cents?: number | null
}

export interface OrderBillingInput {
  service_type: string | null
  price_per_lb_cents: number | null
  commercial_account_id: string | null
  assigned_facility_id: string | null
  // Wash & Fold "per_bag" mode only (see app/actions/pricing.ts). JSON string
  // of {id,label,priceCents,qty}[], resolved and locked in server-side at
  // booking creation (app/actions/bookings.ts createBooking). When present,
  // this — not weightLbs x price_per_lb_cents — is what the customer owes;
  // facility cost below is still weight-based, unaffected.
  wash_fold_bag_selection?: string | null
  // Wash Only "per_bag"/"both" mode (see app/actions/pricing.ts) -- mirrors
  // wash_fold_bag_selection above but for Wash Only's own separate bag-size
  // list. Never conflated with the Wash & Fold field.
  wash_only_bag_selection?: string | null
}

export interface OrderBilling {
  customerFinalCents: number
  facilityCostCents: number
  isCommercial: boolean
  /** Human-readable one-liner for order_events / admin banners. */
  basis: string
}

export async function calculateOrderBilling(
  supabase: AdminClient,
  booking: OrderBillingInput,
  weightLbs: number,
): Promise<OrderBilling> {
  // Commercial pay-at-time-of-service accounts price off their own negotiated
  // rate_type / rate_amount_cents / minimum_amount_cents instead of the
  // consumer per-lb rate — see commercial_accounts.
  let commercial: CommercialRate | null = null
  if (booking.commercial_account_id) {
    const { data } = await supabase
      .from("commercial_accounts")
      .select("rate_type, rate_amount_cents, minimum_amount_cents")
      .eq("id", booking.commercial_account_id)
      .single()
    commercial = (data as CommercialRate | null) ?? null
  }

  // The order minimum, straight from the location's admin pricing settings —
  // the same value checkout quoted this customer. Commercial accounts price
  // off their own negotiated dollar minimum instead and ignore this.
  const minLbs = await resolveMinLbs(booking.service_type)

  let customerFinalCents: number
  let basis: string

  let bagSelection: { id: string; label: string; priceCents: number; qty: number }[] | null = null
  const rawBagSelection = booking.wash_fold_bag_selection || booking.wash_only_bag_selection
  if (!commercial && rawBagSelection) {
    try {
      const parsed = JSON.parse(rawBagSelection)
      if (Array.isArray(parsed) && parsed.length > 0) bagSelection = parsed
    } catch {
      // malformed JSON — fall through to the normal per-lb calc below
    }
  }

  if (bagSelection) {
    // Flat by-the-bag pricing, locked in at booking time — no weight
    // minimum applies (a bag is a bag regardless of what it weighs).
    customerFinalCents = bagSelection.reduce((sum, b) => sum + b.priceCents * b.qty, 0)
    const bagsDesc = bagSelection.map(b => `${b.qty}x ${b.label}`).join(", ")
    basis = `by-the-bag flat rate (${bagsDesc})`
  } else if (commercial) {
    const rateAmount = Number(commercial.rate_amount_cents ?? 0)
    const minimumCents = Number(commercial.minimum_amount_cents ?? 0)
    const rawCents =
      commercial.rate_type === "per_lb" ? Math.round(weightLbs * rateAmount) :
      commercial.rate_type === "flat"   ? rateAmount :
      rateAmount // per_load — same flat amount per order
    customerFinalCents = Math.max(rawCents, minimumCents)
    basis = customerFinalCents > rawCents
      ? `commercial ${commercial.rate_type} rate, billed at the $${(minimumCents / 100).toFixed(2)} account minimum`
      : `commercial ${commercial.rate_type} rate @ $${(rateAmount / 100).toFixed(2)}`
  } else {
    // Consumer rate: this booking's own locked-in price_per_lb_cents (set at
    // checkout — a customer quoted $2.69/lb must always be billed $2.69/lb)
    // takes priority over the current default.
    const rateCents = Number(
      booking.price_per_lb_cents
      ?? DEFAULT_RATE_CENTS[booking.service_type ?? "wash_fold"]
      ?? 250,
    )
    const chargedLbs = Math.max(weightLbs, minLbs)
    customerFinalCents = Math.round(chargedLbs * rateCents)
    basis = chargedLbs > weightLbs
      ? `consumer rate @ $${(rateCents / 100).toFixed(2)}/lb, billed at the ${minLbs} lb minimum`
      : `consumer rate @ $${(rateCents / 100).toFixed(2)}/lb`
  }

  let facilityCostCents = 0
  if (booking.assigned_facility_id) {
    const { data: facility } = await supabase
      .from("facilities")
      .select("rate_per_lb, minimum_lbs")
      .eq("id", booking.assigned_facility_id)
      .single()
    const ratePerLb = Number(facility?.rate_per_lb ?? 0)
    if (ratePerLb > 0) {
      // Whenever an order is light enough that the customer gets billed the
      // order minimum instead of their actual weight, the facility that
      // processed it must be paid for that same minimum too — not just
      // whatever lower weight came off the scale. A facility's own minimum_lbs
      // (its separate contractual floor) can raise this further, but must
      // never silently undercut the order minimum.
      //
      // Commercial orders have no lb minimum of their own (they floor on a
      // dollar amount), so the facility floors on the standard order minimum.
      const facilityBillableLbs = Math.max(weightLbs, Number(facility?.minimum_lbs ?? 0), minLbs)
      facilityCostCents = Math.round(facilityBillableLbs * ratePerLb * 100)
    }
  }

  return { customerFinalCents, facilityCostCents, isCommercial: !!commercial, basis }
}
