import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createAdminClient } from "@/lib/supabase/admin"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-04-10" })
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get("stripe-signature") ?? ""

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error("[webhook] signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    switch (event.type) {

      // ── New plan subscriber signed up ──────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.metadata?.type !== "monthly_plan") break
        if (session.mode !== "subscription") break

        const stripeSubId = typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id
        if (!stripeSubId) break

        const sub = await stripe.subscriptions.retrieve(stripeSubId)
        const meta = sub.metadata

        // Cycle dates from Stripe
        const cycleStart = new Date(sub.current_period_start * 1000).toISOString().split("T")[0]
        const cycleEnd   = new Date(sub.current_period_end   * 1000).toISOString().split("T")[0]

        await supabase.from("subscriptions").insert({
          location_id:             meta.location_id ?? null,
          customer_name:           meta.customer_name,
          customer_email:          session.customer_email ?? "",
          customer_phone:          meta.customer_phone,
          customer_address:        meta.customer_address,
          subscription_type:       "monthly_plan",
          plan_id:                 meta.plan_id,
          frequency:               "monthly",
          pickup_day_of_week:      meta.pickup_day_of_week,
          pickup_time_window:      meta.pickup_time_window,
          delivery_day_of_week:    meta.delivery_day_of_week,
          delivery_time_window:    meta.delivery_time_window,
          monthly_price_cents:     parseInt(meta.monthly_price_cents ?? "0"),
          lbs_included:            parseInt(meta.lbs_included ?? "0"),
          overage_rate_cents:      parseInt(meta.overage_rate_cents ?? "0"),
          lbs_used_this_cycle:     0,
          cycle_start:             cycleStart,
          cycle_end:               cycleEnd,
          stripe_subscription_id:  stripeSubId,
          stripe_customer_id:      typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
          detergent:               meta.detergent ?? "Standard",
          status:                  "active",
          price_per_lb_cents:      0,   // not used for monthly plans
        })
        break
      }

      // ── Invoice about to be finalized — add overage if applicable ──────────
      case "invoice.upcoming": {
        const invoice = event.data.object as Stripe.Invoice
        const stripeSubId = typeof invoice.subscription === "string"
          ? invoice.subscription
          : (invoice.subscription as any)?.id
        if (!stripeSubId) break

        const { data: dbSub } = await supabase
          .from("subscriptions")
          .select("id, lbs_used_this_cycle, lbs_included, overage_rate_cents, stripe_customer_id")
          .eq("stripe_subscription_id", stripeSubId)
          .eq("subscription_type", "monthly_plan")
          .single()

        if (!dbSub) break

        const overage = Math.max(0, (dbSub.lbs_used_this_cycle ?? 0) - (dbSub.lbs_included ?? 0))
        if (overage > 0) {
          const overageCents = overage * (dbSub.overage_rate_cents ?? 0)
          await stripe.invoiceItems.create({
            customer:    dbSub.stripe_customer_id,
            subscription: stripeSubId,
            amount:      overageCents,
            currency:    "usd",
            description: `Overage: ${overage} lbs × $${((dbSub.overage_rate_cents ?? 0) / 100).toFixed(2)}/lb`,
          })
          console.log(`[webhook] Overage invoice item added: ${overage} lbs, $${(overageCents / 100).toFixed(2)}`)
        }
        break
      }

      // ── Invoice paid — reset cycle usage, update cycle dates ──────────────
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice
        const stripeSubId = typeof invoice.subscription === "string"
          ? invoice.subscription
          : (invoice.subscription as any)?.id
        if (!stripeSubId) break

        // Get fresh cycle dates from Stripe
        const sub = await stripe.subscriptions.retrieve(stripeSubId)
        const cycleStart = new Date(sub.current_period_start * 1000).toISOString().split("T")[0]
        const cycleEnd   = new Date(sub.current_period_end   * 1000).toISOString().split("T")[0]

        await supabase
          .from("subscriptions")
          .update({
            lbs_used_this_cycle: 0,
            cycle_start: cycleStart,
            cycle_end:   cycleEnd,
            status:      "active",
          })
          .eq("stripe_subscription_id", stripeSubId)
          .eq("subscription_type", "monthly_plan")
        break
      }

      // ── Payment failed — mark past_due ────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        const stripeSubId = typeof invoice.subscription === "string"
          ? invoice.subscription
          : (invoice.subscription as any)?.id
        if (!stripeSubId) break

        await supabase
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("stripe_subscription_id", stripeSubId)
        break
      }

      // ── Subscription cancelled in Stripe ──────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        await supabase
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("stripe_subscription_id", sub.id)
        break
      }

      default:
        // Unhandled event type — that's fine
        break
    }
  } catch (err) {
    console.error(`[webhook] Error handling ${event.type}:`, err)
    return NextResponse.json({ error: "Handler error" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
