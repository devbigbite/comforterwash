import "server-only"

// Tenant-level Stripe Connect — lets each tenant receive their own customer
// payments directly instead of everything landing in the platform's shared
// Stripe balance (see lib/stripe.ts). This is a SEPARATE concern from the
// facility partner-attendant payout system in app/actions/facility-payments.ts
// (which uses facilities.stripe_account_id/stripe_onboarding_complete and
// must keep working exactly as it does today) — this one lives on
// locations.stripe_connect_account_id / stripe_connect_status instead.
//
// No per-transaction platform fee is taken yet (no application_fee_amount) —
// monetization stays on the existing flat monthly SaaS billing in
// app/actions/platform-billing.ts. Tenants who haven't connected yet keep
// working exactly as today, charging into the shared platform account —
// nothing breaks for existing tenants (including WashFold Orlando) the
// moment this ships.

import { stripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"

export interface ConnectStatus {
  accountId: string | null
  status: "not_connected" | "pending" | "active"
  required: boolean
}

export async function getConnectStatusForLocation(locationId: string): Promise<ConnectStatus> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("locations")
    .select("stripe_connect_account_id, stripe_connect_status, stripe_connect_required")
    .eq("id", locationId)
    .single()

  return {
    accountId: data?.stripe_connect_account_id ?? null,
    status: (data?.stripe_connect_status as ConnectStatus["status"]) ?? "not_connected",
    required: data?.stripe_connect_required ?? true,
  }
}

// ── Direct charges ───────────────────────────────────────────────────────────
// Tenant-customer payments are created ON the tenant's connected account (a
// "direct charge") rather than on the platform with transfer_data (a
// "destination charge"). Stripe recommends direct charges for SaaS platforms,
// where the customer believes they are buying from the tenant, and the
// practical differences all matter here:
//
//   - the tenant is the merchant of record, so THEIR name is on the customer's
//     card statement instead of ours
//   - Stripe's processing fees and dispute fees are billed to the tenant's
//     account (these accounts are created with type: "express", which Stripe
//     treats as fee payer "application_express") instead of to us
//   - refunds and chargebacks hit the tenant's balance, not the platform's
//
// Under the old destination-charge model the platform absorbed every one of
// those, which meant a busy tenant cost more in Stripe fees than their monthly
// subscription brought in.
//
// Returns null for a tenant with no active connected account — those charges
// keep running on the shared platform account exactly as before (WashFold
// Orlando and the demo tenant, both grandfathered via stripe_connect_required
// = false).
export async function directChargeAccountFor(locationId: string): Promise<string | null> {
  try {
    const { status, accountId } = await getConnectStatusForLocation(locationId)
    return status === "active" && accountId ? accountId : null
  } catch {
    return null
  }
}

// Stripe request options for a direct charge. Returns undefined when there's no
// connected account, which the SDK treats as an ordinary platform-account call.
//
// EVERY Stripe object involved in one payment must be created and read with the
// same options — a Customer, PaymentMethod, PaymentIntent or Checkout Session
// that lives on a connected account is invisible to a platform-account call
// ("No such customer"), and vice versa.
export function acctOpts(accountId: string | null | undefined): { stripeAccount: string } | undefined {
  return accountId ? { stripeAccount: accountId } : undefined
}

// ── "Going live" gate ────────────────────────────────────────────────────────
// New tenants (stripe_connect_required = true, the default) must finish their
// own Stripe onboarding before their site can process a real customer charge —
// their money should never sit in the platform's shared Stripe balance. Two
// tenants are grandfathered false: WashFold Orlando (predates this policy,
// already live on the shared account) and the internal WashFoldDemo tenant
// (never takes real money — prospects should never hit a payment gate while
// just exploring the system).
export async function isCheckoutBlockedByConnectRequirement(locationId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("locations")
    .select("stripe_connect_required, stripe_connect_status")
    .eq("id", locationId)
    .single()

  if (!data?.stripe_connect_required) return false
  return data.stripe_connect_status !== "active"
}

// Creates a Stripe Express account for this tenant if one doesn't already
// exist, then returns a fresh hosted onboarding link. Express (not Standard)
// so tenants get a guided, Stripe-hosted signup with minimal setup — good
// fit for non-technical solo/home-based operators.
export async function createConnectOnboardingLink(
  locationId: string,
  returnUrl: string,
  refreshUrl: string,
): Promise<{ url: string; error?: string }> {
  const supabase = createAdminClient()
  const { data: location } = await supabase
    .from("locations")
    .select("stripe_connect_account_id, business_name, support_email")
    .eq("id", locationId)
    .single()

  let accountId = location?.stripe_connect_account_id ?? null

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      business_profile: { name: location?.business_name ?? undefined },
      email: location?.support_email ?? undefined,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    })
    accountId = account.id
    await supabase
      .from("locations")
      .update({ stripe_connect_account_id: accountId, stripe_connect_status: "pending" })
      .eq("id", locationId)
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: returnUrl,
    refresh_url: refreshUrl,
  })

  return { url: link.url }
}

// Called when a tenant lands back on /admin/branding after onboarding (or
// clicks "Refresh Status") — pulls the real state from Stripe rather than
// trusting anything client-controlled.
export async function refreshConnectStatusForLocation(locationId: string): Promise<ConnectStatus> {
  const supabase = createAdminClient()
  const { data: location } = await supabase
    .from("locations")
    .select("stripe_connect_account_id, stripe_connect_required")
    .eq("id", locationId)
    .single()

  const required = location?.stripe_connect_required ?? true

  if (!location?.stripe_connect_account_id) {
    return { accountId: null, status: "not_connected", required }
  }

  const account = await stripe.accounts.retrieve(location.stripe_connect_account_id)
  const status: ConnectStatus["status"] = account.charges_enabled ? "active" : "pending"

  await supabase
    .from("locations")
    .update({ stripe_connect_status: status })
    .eq("id", locationId)

  return { accountId: location.stripe_connect_account_id, status, required }
}
