import type { PricingConfig } from "@/app/actions/pricing"

export const PRICING_DEFAULTS: PricingConfig = {
  washFoldOneTimeCents: 255,
  washFoldSubCents:     245,
  washFoldMinLbs:       20,
  washOnlyCents:        199,
  washOnlyMinLbs:       20,
  comforterTwinCents:   2900,
  comforterFullCents:   3300,
  comforterQueenCents:  3800,
  comforterKingCents:   4300,
  comforterPromoCents:  3300,
}
