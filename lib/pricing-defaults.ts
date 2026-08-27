export const PRICING_DEFAULTS = {
  washFoldOneTimeCents: 269,
  washFoldSubCents:     255,
  washFoldMinLbs:       18,
  washOnlyCents:        219,
  washOnlyMinLbs:       18,
  // Customer-facing comforter prices — these must match the "struck
  // through" regular prices shown on the promo page (/book/comforter-wash);
  // that page is the source of truth for what customers actually see.
  comforterTwinCents:   3500,
  comforterFullCents:   3700,
  comforterQueenCents:  3900,
  comforterKingCents:   4300,
  comforterPromoCents:  3300,
  // What the processing facility is paid per comforter — intentionally NOT
  // derived from the customer prices above (it's a separate cost input,
  // not a fixed percentage of the sale price). Configurable in
  // /admin/pricing under "Facility Payout" so it never needs a code change.
  comforterFacilityTwinCents:  1300,
  comforterFacilityFullCents:  1360,
  comforterFacilityQueenCents: 1440,
  comforterFacilityKingCents:  1590,
  comforterFacilityPromoCents: 1300,
}
