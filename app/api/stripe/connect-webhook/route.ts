import { NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"
import { stripe } from "@/lib/stripe"
import { markCheckoutAttemptFailed } from "@/app/actions/checkout-attempts"

// ── Connect webhook ──────────────────────────────────────────────────────────
// Tenant-customer payments are direct charges created ON the tenant's own
// connected account, so Stripe fires their events against that account, not
// the platform. Those events arrive with `event.account` set, and every Stripe
// object they reference (session, PaymentIntent, Customer) is only readable
// with { stripeAccount: event.account } — a platform-scoped lookup returns
// "No such checkout session".
//
// This is a SEPARATE endpoint from app/api/stripe/webhook (which handles the
// platform's own money: SaaS subscriptions and self-signup) with its own
// signing secret, so tenant payment events and platform billing events can
// never be confused for one another. Register it in the Stripe dashboard as a
// "Connect" endpoint pointed at /api/stripe/connect-webhook.
// Reuses the shared client from lib/stripe.ts rather than instantiating a
// fourth one — the API version pin on the other webhook route is already a
// source of type drift.
const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET!

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get("stripe-signature") ?? ""

  if (!webhookSecret) {
    console.error("[connect-webhook] STRIPE_CONNECT_WEBHOOK_SECRET is not set")
    return NextResponse.json({ error: "Not configured" }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error("[connect-webhook] signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  // A Connect endpoint should only ever receive connected-account events.
  // Anything without an account is a misconfiguration (platform events pointed
  // at the wrong endpoint) — ignore it rather than processing it here with the
  // wrong scope.
  const account = event.account
  if (!account) {
    console.warn(`[connect-webhook] ignoring platform-scoped event ${event.type} — belongs on /api/stripe/webhook`)
    return NextResponse.json({ received: true, ignored: true })
  }

  try {
    switch (event.type) {
      // ── Fallback safety net for one-time checkouts ──────────────────────
      // handleSuccessfulPayment normally runs from the browser the instant
      // Stripe reports success (components/checkout.tsx). This covers the
      // customer whose tab closed or lost network in that window. It is
      // idempotent — it claims the checkout_attempts row before doing any
      // work — so whichever path runs first does the work and the other is a
      // no-op. Never creates a duplicate booking.
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === "payment") {
          const { handleSuccessfulPayment } = await import("@/app/actions/stripe")
          const result = await handleSuccessfulPayment(session.id, account)
          if (!result.success) {
            console.error(`[connect-webhook] handleSuccessfulPayment failed for ${session.id} on ${account}:`, result.error)
          }
        }
        break
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session
        await markCheckoutAttemptFailed({
          stripeCheckoutSessionId: session.id,
          status: "expired",
        })
        break
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent
        await markCheckoutAttemptFailed({
          stripePaymentIntentId: pi.id,
          status: "failed",
          failureReason: pi.last_payment_error?.message ?? null,
        })
        break
      }

      default:
        break
    }
  } catch (err) {
    // Returning 500 makes Stripe retry, which is what we want for a transient
    // failure — but never for an event we simply don't handle.
    console.error(`[connect-webhook] handler error for ${event.type} on ${account}:`, err)
    return NextResponse.json({ error: "Handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
