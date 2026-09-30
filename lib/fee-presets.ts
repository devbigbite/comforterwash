/** Preset misc fee types — imported by both server actions and client components.
 *  $10 matches the policy quoted to customers on the FAQ and legal pages
 *  (app/actions/faq.ts, app/actions/legal.ts) -- these were out of sync at
 *  $15 until Sep 2026; keep all three in agreement if the policy changes. */
export const FEE_PRESETS = [
  { label: "Missed Pickup",     amount_cents: 1000 },
  { label: "Cancelled Pickup",  amount_cents: 1000 },
  { label: "Late Cancellation", amount_cents: 1000 },
  { label: "Redelivery",        amount_cents: 1000 },
] as const
