/** Preset misc fee types — imported by both server actions and client components */
export const FEE_PRESETS = [
  { label: "Missed Pickup",     amount_cents: 1500 },
  { label: "Cancelled Pickup",  amount_cents: 1500 },
  { label: "Late Cancellation", amount_cents: 1000 },
  { label: "Redelivery",        amount_cents: 1000 },
] as const
