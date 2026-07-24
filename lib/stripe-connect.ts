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
}

export async function getConnectStatusForLocation(locationId: string): Promise<ConnectStatus> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("locations")
    .select("stripe_connect_account_id, stripe_connect_status")
    .eq("id", locationId)
    .single()

  return {
    accountId: data?.stripe_connect_account_id ?? null,
    status: (data?.stripe_connect_status as ConnectStatus["status"]) ?? "not_connected",
  }
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
    .select("stripe_connect_account_id")
    .eq("id", locationId)
    .single()

  if (!location?.stripe_connect_account_id) {
    return { accountId: null, status: "not_connected" }
  }

  const account = await stripe.accounts.retrieve(location.stripe_connect_account_id)
  const status: ConnectStatus["status"] = account.charges_enabled ? "active" : "pending"

  await supabase
    .from("locations")
    .update({ stripe_connect_status: status })
    .eq("id", locationId)

  return { accountId: location.stripe_connect_account_id, status }
}
