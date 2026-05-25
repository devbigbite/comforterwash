"use server"

import Stripe from "stripe"
import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-04-10" })

export interface SubscriptionPlan {
  id: string
  location_id: string
  name: string
  monthly_price_cents: number
  lbs_included: number
  overage_rate_cents: number
  stripe_product_id: string | null
  stripe_price_id: string | null
  is_popular: boolean
  is_active: boolean
  sort_order: number
  min_commitment_months: number
  created_at: string
}

// ── Public: fetch active plans for pricing page ───────────────────────────────
export async function getActivePlans(): Promise<SubscriptionPlan[]> {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("location_id", locationId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
  return (data ?? []) as SubscriptionPlan[]
}

// ── Admin: fetch all plans (including inactive) ───────────────────────────────
export async function getAllPlans(): Promise<SubscriptionPlan[]> {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("location_id", locationId)
    .order("sort_order", { ascending: true })
  return (data ?? []) as SubscriptionPlan[]
}

// ── Admin: create plan (syncs Stripe Product + Price) ────────────────────────
export async function createPlan(input: {
  await requireAdmin()

  name: string
  monthly_price_cents: number
  lbs_included: number
  overage_rate_cents: number
  is_popular: boolean
  is_active: boolean
  sort_order: number
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const [supabase, locationId] = [createAdminClient(), await getLocationId()]

    // Create Stripe Product
    const product = await stripe.products.create({
      name: `WashFold ${input.name} Plan`,
      metadata: { lbs_included: String(input.lbs_included) },
    })

    // Create Stripe recurring Price
    const price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: input.monthly_price_cents,
      recurring: { interval: "month" },
      metadata: { plan_name: input.name },
    })

    const { error } = await supabase.from("subscription_plans").insert({
      location_id:          locationId,
      name:                 input.name,
      monthly_price_cents:  input.monthly_price_cents,
      lbs_included:         input.lbs_included,
      overage_rate_cents:   input.overage_rate_cents,
      stripe_product_id:    product.id,
      stripe_price_id:      price.id,
      is_popular:           input.is_popular,
      is_active:            input.is_active,
      sort_order:           input.sort_order,
    })

    if (error) throw error
    return { ok: true }
  } catch (err: unknown) {
    console.error("[createPlan]", err)
    return { ok: false, error: (err as Error).message }
  }
}

// ── Admin: update plan ────────────────────────────────────────────────────────
// If price changes, archives old Stripe Price and creates a new one.
export async function updatePlan(
  id: string,
  input: Partial<{
  await requireAdmin()

    name: string
    monthly_price_cents: number
    lbs_included: number
    overage_rate_cents: number
    is_popular: boolean
    is_active: boolean
    sort_order: number
  }>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("stripe_product_id, stripe_price_id, monthly_price_cents, name")
      .eq("id", id)
      .single()

    if (!plan) throw new Error("Plan not found")

    let newPriceId = plan.stripe_price_id
    const priceChanged = input.monthly_price_cents !== undefined &&
      input.monthly_price_cents !== plan.monthly_price_cents

    // Update Stripe product name if name changed
    if (plan.stripe_product_id && input.name && input.name !== plan.name) {
      await stripe.products.update(plan.stripe_product_id, {
        name: `WashFold ${input.name} Plan`,
      })
    }

    // If price changed: deactivate old Price, create new one
    if (priceChanged && plan.stripe_product_id) {
      if (plan.stripe_price_id) {
        await stripe.prices.update(plan.stripe_price_id, { active: false }).catch(() => {})
      }
      const newPrice = await stripe.prices.create({
        product: plan.stripe_product_id,
        currency: "usd",
        unit_amount: input.monthly_price_cents!,
        recurring: { interval: "month" },
        metadata: { plan_name: input.name ?? plan.name },
      })
      newPriceId = newPrice.id
    }

    const { error } = await supabase
      .from("subscription_plans")
      .update({
        ...input,
        ...(priceChanged ? { stripe_price_id: newPriceId } : {}),
      })
      .eq("id", id)

    if (error) throw error
    return { ok: true }
  } catch (err: unknown) {
    console.error("[updatePlan]", err)
    return { ok: false, error: (err as Error).message }
  }
}

// ── Admin: delete (soft-archive) plan ────────────────────────────────────────
export async function deletePlan(id: string): Promise<{
  await requireAdmin()
 ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("stripe_price_id, stripe_product_id")
      .eq("id", id)
      .single()

    // Deactivate Stripe price so no new subscriptions can use it
    if (plan?.stripe_price_id) {
      await stripe.prices.update(plan.stripe_price_id, { active: false }).catch(() => {})
    }

    const { error } = await supabase
      .from("subscription_plans")
      .update({ is_active: false })
      .eq("id", id)

    if (error) throw error
    return { ok: true }
  } catch (err: unknown) {
    console.error("[deletePlan]", err)
    return { ok: false, error: (err as Error).message }
  }
}

// ── Plan checkout: create Stripe Checkout Session (subscription mode) ─────────
export async function startPlanCheckout(params: {
  planId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  customerAddress: string
  deliveryAddress: string
  pickupDayOfWeek: string
  pickupTimeWindow: string
  deliveryDayOfWeek: string
  deliveryTimeWindow: string
  detergent: string
}): Promise<{ clientSecret: string; sessionId: string } | { error: string }> {
  try {
    const supabase = createAdminClient()
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("stripe_price_id, name, lbs_included, overage_rate_cents, monthly_price_cents, min_commitment_months")
      .eq("id", params.planId)
      .single()

    if (!plan?.stripe_price_id) throw new Error("Plan not found or has no Stripe price")

    const minMonths = plan.min_commitment_months ?? 3
    // Commitment end = today + min months. Stripe cancel_at prevents customer
    // from cancelling before this date through the Stripe portal.
    const commitmentEndsAt = new Date()
    commitmentEndsAt.setMonth(commitmentEndsAt.getMonth() + minMonths)
    const cancelAt = Math.floor(commitmentEndsAt.getTime() / 1000)

    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      redirect_on_completion: "never",
      mode: "subscription",
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      customer_email: params.customerEmail,
      subscription_data: {
        cancel_at: cancelAt,
        metadata: {
          plan_id:                  params.planId,
          customer_name:            params.customerName,
          customer_phone:           params.customerPhone,
          customer_address:         params.customerAddress,
          delivery_address:         params.deliveryAddress,
          pickup_day_of_week:       params.pickupDayOfWeek,
          pickup_time_window:       params.pickupTimeWindow,
          delivery_day_of_week:     params.deliveryDayOfWeek,
          delivery_time_window:     params.deliveryTimeWindow,
          detergent:                params.detergent,
          lbs_included:             String(plan.lbs_included),
          overage_rate_cents:       String(plan.overage_rate_cents),
          monthly_price_cents:      String(plan.monthly_price_cents),
          min_commitment_months:    String(minMonths),
          commitment_ends_at:       commitmentEndsAt.toISOString().split("T")[0],
        },
      },
      metadata: {
        type: "monthly_plan",
        plan_id: params.planId,
        customer_name: params.customerName,
        customer_phone: params.customerPhone,
      },
    })

    return { clientSecret: session.client_secret!, sessionId: session.id }
  } catch (err: unknown) {
    console.error("[startPlanCheckout]", err)
    return { error: (err as Error).message }
  }
}
