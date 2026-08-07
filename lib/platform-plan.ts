// ── Self-signup plan config ──────────────────────────────────────────────────
// Single flat plan shown on the public /start signup page (the "Stan Store"
// style checkout — pick it, pay it, get provisioned automatically). Edit the
// numbers below to change pricing; nothing else needs to change.
//
// NOTE: these are placeholder numbers — nobody confirmed real pricing when
// this was built. Update before sending real traffic to /start.
export const SELF_SIGNUP_PLAN = {
  name: "WashFoldClean Platform",
  setupFeeCents: 19900,      // $199 one-time, charged immediately at checkout — matches the number already advertised on /platform
  monthlyPriceCents: 9900,   // $99/mo, billed after the trial ends
  trialDays: 7,
}
