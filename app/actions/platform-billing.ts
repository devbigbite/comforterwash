"use server"

// ── Phase 4: per-tenant platform billing ──────────────────────────────────────
// Each tenant location can be put on a flat monthly Stripe subscription. This
// is billing FOR the tenant (what they pay to use the SaaS), distinct from
// app/actions/subscriptions.ts which handles a tenant's own CUSTOMERS paying
// for recurring laundry plans.
//
// Flow: super-admin sets a monthly price on a location, generates a Stripe
// Checkout link, and sends it to the tenant. The tenant enters their own card
// on Stripe's hosted page — we never touch card data. The webhook
// (app/api/stripe/webhook/route.ts) marks the location active once payment
// succeeds and keeps billing_status in sync afterward.

import { stripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireSuperAdmin, requireAdmin } from "@/lib/auth-guard"
import { getLocationId, ORLANDO_LOCATION_ID } from "@/lib/location"
import { revalidatePath } from "next/cache"

export interface LocationBilling {
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  billing_status: "none" | "trialing" | "active" | "past_due" | "canceled"
  plan_price_cents: number | null
  plan_name: string | null
}

export async function getLocationBilling(locationId: string): Promise<LocationBilling | null> {
  await requireSuperAdmin()
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("locations")
    .select("stripe_customer_id, stripe_subscription_id, billing_status, plan_price_cents, plan_name")
    .eq("id", locationId)
    .single()
  return data as LocationBilling | null
}

// Sets (or updates) the flat monthly price for a tenant without touching
// Stripe — the actual subscription is created once the tenant completes
// the checkout link below.
export async function setLocationPlanPrice(
  locationId: string,
  planName: string,
  planPriceCents: number,
): Promise<{ error?: string }> {
  await requireSuperAdmin()
  if (planPriceCents < 0) return { error: "Price can't be negative" }
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("locations")
    .update({ plan_name: planName.trim() || null, plan_price_cents: planPriceCents })
    .eq("id", locationId)
  if (error) return { error: error.message }
  revalidatePath("/super-admin")
  return {}
}

// Creates a Stripe Checkout session (subscription mode) for the tenant's
// flat monthly price. Returns a URL the super-admin can send to the tenant.
export async function createBillingCheckoutLink(locationId: string): Promise<{ url?: string; error?: string }> {
  await requireSuperAdmin()
  const supabase = createAdminClient()
  const { data: loc } = await supabase
    .from("locations")
    .select("id, name, plan_name, plan_price_cents, stripe_customer_id")
    .eq("id", locationId)
    .single()

  if (!loc) return { error: "Location not found" }
  if (!loc.plan_price_cents || loc.plan_price_cents <= 0) {
    return { error: "Set a monthly plan price for this location first." }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://comforterwash.com"

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: loc.stripe_customer_id ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `${loc.plan_name || "Platform"} — Monthly Subscription (${loc.name})` },
          unit_amount: loc.plan_price_cents,
          recurring: { interval: "month" },
        },
        quantity: 1,
      },
    ],
    metadata: { type: "platform_subscription", location_id: loc.id },
    subscription_data: { metadata: { type: "platform_subscription", location_id: loc.id } },
    success_url: `${siteUrl}/super-admin?billing=success`,
    cancel_url: `${siteUrl}/super-admin?billing=cancelled`,
  })

  if (!session.url) return { error: "Stripe did not return a checkout URL" }
  return { url: session.url }
}

// Read-only billing-status check for a tenant's own admin (not super-admin) —
// used to show a soft banner if their platform subscription lapses. Orlando
// is the original owner-operated business, not a paying tenant of itself, so
// it's always exempt regardless of its billing_status value.
export async function getMyBillingStatus(): Promise<"none" | "trialing" | "active" | "past_due" | "canceled" | "exempt"> {
  await requireAdmin()
  const locationId = await getLocationId()
  if (locationId === ORLANDO_LOCATION_ID) return "exempt"
  const supabase = createAdminClient()
  const { data } = await supabase.from("locations").select("billing_status").eq("id", locationId).single()
  return (data?.billing_status as "none" | "trialing" | "active" | "past_due" | "canceled") ?? "none"
}

// Cancels a tenant's platform subscription immediately (e.g. offboarding).
export async function cancelLocationBilling(locationId: string): Promise<{ error?: string }> {
  await requireSuperAdmin()
  const supabase = createAdminClient()
  const { data: loc } = await supabase.from("locations").select("stripe_subscription_id").eq("id", locationId).single()
  if (!loc?.stripe_subscription_id) return { error: "No active subscription for this location" }

  try {
    await stripe.subscriptions.cancel(loc.stripe_subscription_id)
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to cancel in Stripe" }
  }

  await supabase.from("locations").update({ billing_status: "canceled" }).eq("id", locationId)
  revalidatePath("/super-admin")
  return {}
}
