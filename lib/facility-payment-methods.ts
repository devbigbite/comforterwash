// How a facility payout was settled. Kept out of app/actions/facility-payments.ts
// on purpose: that file is "use server", and Next.js only permits async function
// exports from a server-action module — a plain const there breaks the build.
// Both the admin page (server) and the partner portal (client) import from here.
export const PAYMENT_METHODS = [
  { value: "cash",   label: "Cash" },
  { value: "check",  label: "Check" },
  { value: "zelle",  label: "Zelle / bank transfer" },
  { value: "other",  label: "Other" },
] as const

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  stripe: "Stripe",
  cash:   "Cash",
  check:  "Check",
  zelle:  "Zelle / bank transfer",
  other:  "Other",
}
