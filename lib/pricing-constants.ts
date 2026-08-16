// ── Shared billing constants ──────────────────────────────────────────────
// Pulled out of app/actions/weigh-in.ts because that file has "use server" —
// Next.js Server Actions files may only export async functions, so plain
// constants (CUSTOMER_MIN_LBS, DEFAULT_RATE_CENTS) can't live there even
// though weigh-in.ts is their main consumer. This file has no directive, so
// both server code (weigh-in.ts, transport-runs.ts) and the driver order
// page can import it safely.

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
