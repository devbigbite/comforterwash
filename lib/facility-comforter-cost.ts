// What WashFold owes the processing facility for a comforter-wash order.
//
// Comforter orders are flat-rate to the customer and never go through the
// weigh-in step (app/actions/weigh-in.ts) that normally writes
// facility_cost_cents on every other service type — so a comforter order
// assigned to a facility would otherwise sit with facility_cost_cents null
// forever and never show up in that facility's payout balance
// (see /admin/facility-payments). This computes that accrual once, up
// front, from the comforter sizes/quantities on the order and whether the
// $33-any-size promo was active.
//
// The rates themselves live in PricingConfig (app/actions/pricing.ts,
// editable at /admin/pricing → "Facility Payout") — NOT hardcoded here —
// so changing the payout doesn't require a code change, and changing the
// customer-facing comforter prices doesn't silently change what the
// facility is paid (the two are independent numbers).

export interface ComforterFacilityRates {
  twinCents:  number
  fullCents:  number
  queenCents: number
  kingCents:  number
  promoCents: number
}

export function computeComforterFacilityCostCents(
  comforterSizes: string | null | undefined, // e.g. "Queen:1,King:2"
  numComforters: number,
  promoActive: boolean,
  rates: ComforterFacilityRates,
): number {
  const sizeRateCents: Record<string, number> = {
    Twin:  rates.twinCents,
    Full:  rates.fullCents,
    Queen: rates.queenCents,
    King:  rates.kingCents,
  }

  const entries = (comforterSizes ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      const [label, qtyStr] = s.split(":")
      return { label: label?.trim() ?? "", qty: parseInt(qtyStr ?? "1", 10) || 0 }
    })
    .filter(e => e.qty > 0)

  if (promoActive) {
    const totalQty = entries.length > 0
      ? entries.reduce((sum, { qty }) => sum + qty, 0)
      : Math.max(numComforters, 1)
    return totalQty * rates.promoCents
  }

  if (entries.length > 0) {
    return entries.reduce(
      (sum, { label, qty }) => sum + (sizeRateCents[label] ?? rates.queenCents) * qty,
      0,
    )
  }

  // Older/edge-case bookings with no comforter_sizes breakdown — fall back
  // to the mid-tier (Queen) rate rather than guessing high or low.
  return Math.max(numComforters, 1) * rates.queenCents
}
