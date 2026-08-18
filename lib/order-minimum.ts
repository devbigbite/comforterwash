// ── Order weight minimum, resolved from admin settings ───────────────────
// The single source of truth for "how many pounds does a light order get
// billed at". Both the customer charge and the facility payout floor at this
// number, and so does the checkout quote — they must never disagree.
//
// Why this file exists: the billing path used to floor at a hardcoded 20 lb
// (CUSTOMER_MIN_LBS in lib/pricing-constants.ts) while checkout quoted off the
// admin-editable settings value of 18 lb. A 11.1 lb order was therefore quoted
// $45.90 (18 x $2.55) but paid its facility $20.00 (20 x $1.00), and clicking
// "Recalculate billing" would have silently repriced the customer to $51.00.
// Changing the minimum in admin now moves every one of those numbers together.

import { getPricingConfig } from "@/app/actions/pricing"
import { FALLBACK_MIN_LBS } from "@/lib/pricing-constants"

/**
 * The billable pound minimum for a service type, read from the location's
 * admin pricing settings. Never throws: getPricingConfig() already falls back
 * to its own defaults if the settings read fails, and an implausible value
 * (missing, zero, negative, NaN) falls back to FALLBACK_MIN_LBS rather than
 * silently billing an order at 0 lb.
 */
export async function resolveMinLbs(serviceType: string | null): Promise<number> {
  const cfg = await getPricingConfig()
  const raw = serviceType === "wash_only" ? cfg.washOnlyMinLbs : cfg.washFoldMinLbs
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : FALLBACK_MIN_LBS
}
