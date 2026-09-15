// ── Hanger add-on billing ──────────────────────────────────────────────────
// Hangers are counted by the operator when folding/finishing an order — the
// quantity is unknown until then, which is usually AFTER the main
// weight-based charge (calculateOrderBilling / capturePayment) has already
// captured. So this is deliberately a separate, second charge against the
// same saved card, not part of calculateOrderBilling. Mirrors the shape of
// the weight-overage charge in app/actions/stripe.ts capturePayment().
//
// Facility payout is intentionally untouched — hangers do not add to
// facility_cost_cents (2026-09-15 decision, no per-hanger facility rate yet).

import { getPricingConfig } from "@/app/actions/pricing"

/** Current per-hanger price in cents, from admin pricing settings. */
export async function resolveHangerPriceCents(): Promise<number> {
  const cfg = await getPricingConfig()
  const n = Number(cfg.hangerPriceCents)
  return Number.isFinite(n) && n > 0 ? n : 22
}
