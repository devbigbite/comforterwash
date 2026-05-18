"use server"

import { stripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"
import { createBooking } from "./bookings"
import { createSubscription } from "./subscriptions"
import { sendBookingConfirmationEmail, sendAdminNewOrderEmail } from "@/lib/email"

// ── Checkout session ──────────────────────────────────────────────────────────
// amountCents: the pre-auth ceiling (already includes 25% buffer for wash-fold)
// manualCapture: if true, only authorizes — you must call capturePayment() later
export async function startCheckoutSession(
  amountCents: number,
  label: string,
  metadata?: Record<string, string>,
  manualCapture = false
) {
  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    redirect_on_completion: "never",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: label },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    payment_intent_data: {
      ...(manualCapture ? { capture_method: "manual" } : {}),
      setup_future_usage: "off_session",
    },
    metadata: metadata ?? {},
  })

  return { clientSecret: session.client_secret!, sessionId: session.id }
}

// ── Capture actual payment after weight is confirmed ──────────────────────────
// If actual amount exceeds the pre-auth ceiling, the overage is charged
// immediately to the saved payment method as a second PaymentIntent.
export async function capturePayment(bookingId: string) {
  const supabase = createAdminClient()
  const { data: booking } = await supabase
    .from("bookings")
    .select("stripe_payment_intent_id, customer_final_cents, pre_auth_cents, stripe_customer_id, stripe_payment_method_id")
    .eq("id", bookingId)
    .single()

  if (!booking?.stripe_payment_intent_id) {
    throw new Error("No payment intent found for booking")
  }

  const finalCents   = booking.customer_final_cents
  if (!finalCents) throw new Error("No final amount set — enter weight first")

  const preAuth      = booking.pre_auth_cents ?? finalCents
  const captureAmt   = Math.min(finalCents, preAuth)
  const overageCents = Math.max(0, finalCents - preAuth)

  // Capture the pre-authorized amount (or the full amount if within ceiling)
  await stripe.paymentIntents.capture(booking.stripe_payment_intent_id, {
    amount_to_capture: captureAmt,
  })

  await supabase
    .from("bookings")
    .update({ payment_status: "captured" })
    .eq("id", bookingId)

  // ── Charge the overage if actual weight blew past the pre-auth buffer ──
  if (overageCents > 0) {
    // Every order goes through Stripe checkout, so a card is always on file.
    // Use stored PM if available; otherwise retrieve it from the original PI.
    let pmId = booking.stripe_payment_method_id
    let customerId = booking.stripe_customer_id

    if (!pmId) {
      const originalPI = await stripe.paymentIntents.retrieve(
        booking.stripe_payment_intent_id,
        { expand: ["payment_method"] }
      )
      pmId = typeof originalPI.payment_method === "string"
        ? originalPI.payment_method
        : (originalPI.payment_method as { id: string } | null)?.id ?? null

      // If we still have no customer, create one and attach the card now
      if (pmId && !customerId) {
        const { data: bkMeta } = await supabase
          .from("bookings")
          .select("customer_name, customer_email")
          .eq("id", bookingId)
          .single()
        const cust = await stripe.customers.create({
          name:           bkMeta?.customer_name ?? undefined,
          email:          bkMeta?.customer_email ?? undefined,
          payment_method: pmId,
        })
        customerId = cust.id
        await supabase.from("bookings").update({
          stripe_customer_id:       customerId,
          stripe_payment_method_id: pmId,
        }).eq("id", bookingId)
      }
    }

    if (!pmId) {
      // Should never happen — every booking has a Stripe PaymentIntent with a card
      throw new Error(`[stripe] No payment method found for booking ${bookingId} — cannot charge overage`)
    }

    try {
      const overagePI = await stripe.paymentIntents.create({
        amount:         overageCents,
        currency:       "usd",
        customer:       customerId ?? undefined,
        payment_method: pmId,
        confirm:        true,
        off_session:    true,
        description:    `Weight overage charge — booking ${bookingId}`,
        metadata:       { bookingId, type: "weight_overage" },
      })

      await supabase.from("bookings").update({
        overage_cents:             overageCents,
        overage_payment_intent_id: overagePI.id,
        overage_status:            overagePI.status === "succeeded" ? "charged" : "pending",
      }).eq("id", bookingId)

      console.log(`[stripe] Overage $${(overageCents / 100).toFixed(2)} charged — PI ${overagePI.id}`)
    } catch (err) {
      console.error("[stripe] Overage charge failed:", err)
      await supabase.from("bookings").update({
        overage_cents:  overageCents,
        overage_status: "failed",
      }).eq("id", bookingId)
    }
  }

  return { captured: captureAmt, overageCents }
}

// ── Save payment method after checkout completes ──────────────────────────────
// Called inside handleSuccessfulPayment to persist the card for future charges.
async function saveBookingPaymentMethod(bookingId: string, paymentIntentId: string, customerName: string, customerEmail?: string) {
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["payment_method"],
    })
    const pmId = typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id
    if (!pmId) return

    // Create or reuse a Stripe Customer so the card can be charged off-session
    const customer = await stripe.customers.create({
      name:           customerName,
      email:          customerEmail ?? undefined,
      payment_method: pmId,
    })
    await stripe.paymentMethods.attach(pmId, { customer: customer.id }).catch(() => {/* already attached */})

    const supabase = createAdminClient()
    await supabase.from("bookings").update({
      stripe_customer_id:       customer.id,
      stripe_payment_method_id: pmId,
    }).eq("id", bookingId)
  } catch (err) {
    console.error("[stripe] saveBookingPaymentMethod failed:", err)
  }
}

// ── Handle completed Stripe checkout ─────────────────────────────────────────
export async function handleSuccessfulPayment(sessionId: string) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const isManual = (session as { payment_intent_data?: { capture_method?: string } })
      .payment_intent_data?.capture_method === "manual"

    if ((session.payment_status === "paid" || isManual) && session.metadata) {
      const meta = session.metadata
      const preAuthCents  = session.amount_total ?? 0
      const frequency     = meta.subscriptionFrequency ?? "one_time"
      const paymentIntent = session.payment_intent as string

      const booking = await createBooking({
        customerName:    meta.customerName,
        customerEmail:   meta.customerEmail,
        customerPhone:   meta.customerPhone,
        customerAddress: meta.address,
        pickupDate:      meta.pickupDate,
        pickupTimeWindow:   meta.pickupTimeWindow,
        deliveryDate:    meta.deliveryDate,
        deliveryTimeWindow: meta.deliveryTimeWindow,
        numComforters:   parseInt(meta.numComforters ?? meta.quantity ?? "1"),
        totalAmount:     preAuthCents,
        stripePaymentIntentId: paymentIntent,
        serviceType:     (meta.serviceType as "comforter_wash" | "wash_fold" | "wash_only") ?? "comforter_wash",
        pounds:          meta.pounds ? parseFloat(meta.pounds) : undefined,
        numBags:         meta.numBags ? parseInt(meta.numBags) : undefined,
        preAuthCents,
        isManualCapture: isManual,
        subscriptionFrequency: frequency,
        pricePerLbCents: meta.pricePerLbCents ? parseInt(meta.pricePerLbCents) : undefined,
        promoCode:           meta.promoCode ?? undefined,
        promoDiscountCents:  meta.promoDiscountCents ? parseInt(meta.promoDiscountCents) : undefined,
        tipCents:            meta.tipCents ? parseInt(meta.tipCents) : undefined,
        deliveryFeeCents:    meta.deliveryFeeCents ? parseInt(meta.deliveryFeeCent