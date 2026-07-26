"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"
import { sendAbandonedCheckoutAlertEmail } from "@/lib/email"

// Tracks every checkout attempt from the moment the Stripe embedded checkout
// session is created — separate from `bookings`, which only ever gets a row
// once payment actually succeeds. Without this, a declined card or an
// abandoned checkout leaves zero trace anywhere: no booking, no order, no
// way for staff to follow up with a customer who clearly intended to book.
export interface CheckoutAttempt {
  id: string
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  customer_address: string | null
  service_type: string | null
  pickup_date: string | null
  pickup_time_window: string | null
  delivery_date: string | null
  delivery_time_window: string | null
  amount_cents: number | null
  status: "pending" | "succeeded" | "failed" | "expired"
  failure_reason: string | null
  booking_id: string | null
  created_at: string
  updated_at: string
}

/** Called from startCheckoutSession the moment a Stripe session is created — before the customer has necessarily paid. */
export async function recordCheckoutAttempt(params: {
  stripeCheckoutSessionId: string
  stripePaymentIntentId?: string | null
  amountCents: number
  metadata: Record<string, string>
}) {
  try {
    const supabase = createAdminClient()
    const locationId = await getLocationId()
    const meta = params.metadata
    await supabase.from("checkout_attempts").insert({
      location_id: locationId,
      stripe_checkout_session_id: params.stripeCheckoutSessionId,
      stripe_payment_intent_id: params.stripePaymentIntentId ?? null,
      customer_name: meta.customerName ?? null,
      customer_email: meta.customerEmail ?? null,
      customer_phone: meta.customerPhone ?? null,
      customer_address: meta.address ?? null,
      service_type: meta.serviceType ?? null,
      pickup_date: meta.pickupDate ?? null,
      pickup_time_window: meta.pickupTimeWindow ?? null,
      delivery_date: meta.deliveryDate ?? null,
      delivery_time_window: meta.deliveryTimeWindow ?? null,
      amount_cents: params.amountCents,
      status: "pending",
    })
  } catch (err) {
    // Never block checkout over this — it's a follow-up aid, not critical path
    console.error("[checkout-attempts] recordCheckoutAttempt failed:", err)
  }
}

/** Called once handleSuccessfulPayment has created the real booking. */
export async function markCheckoutAttemptSucceeded(stripeCheckoutSessionId: string, bookingId: string) {
  try {
    const supabase = createAdminClient()
    await supabase
      .from("checkout_attempts")
      .update({ status: "succeeded", booking_id: bookingId, updated_at: new Date().toISOString() })
      .eq("stripe_checkout_session_id", stripeCheckoutSessionId)
  } catch (err) {
    console.error("[checkout-attempts] markCheckoutAttemptSucceeded failed:", err)
  }
}

/** Called from the Stripe webhook on checkout.session.expired or payment_intent.payment_failed. */
export async function markCheckoutAttemptFailed(params: {
  stripeCheckoutSessionId?: string | null
  stripePaymentIntentId?: string | null
  status: "failed" | "expired"
  failureReason?: string | null
}) {
  try {
    const supabase = createAdminClient()
    let query = supabase
      .from("checkout_attempts")
      .update({ status: params.status, failure_reason: params.failureReason ?? null, updated_at: new Date().toISOString() })
      // Never downgrade an attempt that already succeeded (race between the
      // client-side confirm call and a late webhook delivery).
      .eq("status", "pending")

    query = params.stripeCheckoutSessionId
      ? query.eq("stripe_checkout_session_id", params.stripeCheckoutSessionId)
      : query.eq("stripe_payment_intent_id", params.stripePaymentIntentId ?? "__none__")

    // .select() returns the row(s) actually updated — only these genuinely
    // just transitioned from pending, so this is also the trigger for the
    // one-time staff alert email (avoids double-alerting on webhook retries,
    // which Stripe does automatically if it doesn't get a fast 200 back).
    const { data: updated } = await query.select()

    for (const row of updated ?? []) {
      sendAbandonedCheckoutAlertEmail({
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        customerPhone: row.customer_phone,
        serviceType: row.service_type,
        amountCents: row.amount_cents,
        status: params.status,
        failureReason: params.failureReason ?? null,
      }).catch(err => console.error("[checkout-attempts] sendAbandonedCheckoutAlertEmail failed:", err))
    }
  } catch (err) {
    console.error("[checkout-attempts] markCheckoutAttemptFailed failed:", err)
  }
}

/** Admin-only: list unfinished/failed checkout attempts for follow-up. Excludes succeeded ones (those became real bookings). */
export async function getAbandonedCheckouts(): Promise<CheckoutAttempt[]> {
  await requireAdmin()
  const supabase = createAdminClient()
  const locationId = await getLocationId()
  const { data } = await supabase
    .from("checkout_attempts")
    .select("*")
    .eq("location_id", locationId)
    .in("status", ["pending", "failed", "expired"])
    .order("created_at", { ascending: false })
    .limit(200)
  return (data ?? []) as CheckoutAttempt[]
}
