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
    ...(manualCapture && {
      payment_intent_data: { capture_method: "manual" },
    }),
    metadata: metadata ?? {},
  })

  return { clientSecret: session.client_secret!, sessionId: session.id }
}

// ── Capture actual payment after weight is confirmed ──────────────────────────
export async function capturePayment(bookingId: string) {
  const supabase = createAdminClient()
  const { data: booking } = await supabase
    .from("bookings")
    .select("stripe_payment_intent_id, customer_final_cents, pre_auth_cents")
    .eq("id", bookingId)
    .single()

  if (!booking?.stripe_payment_intent_id) {
    throw new Error("No payment intent found for booking")
  }

  const captureAmount = booking.customer_final_cents
  if (!captureAmount) throw new Error("No final amount set — enter weight first")

  // Cannot capture more than what was pre-authorized
  if (captureAmount > (booking.pre_auth_cents ?? 0)) {
    console.warn(`[stripe] Capture amount ($${captureAmount / 100}) exceeds pre-auth ($${(booking.pre_auth_cents ?? 0) / 100}) — capping at pre-auth`)
  }

  const amountToCapture = Math.min(captureAmount, booking.pre_auth_cents ?? captureAmount)

  await stripe.paymentIntents.capture(booking.stripe_payment_intent_id, {
    amount_to_capture: amountToCapture,
  })

  await supabase
    .from("bookings")
    .update({ payment_status: "captured" })
    .eq("id", bookingId)

  return { captured: amountToCapture }
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
        comforterSize:   meta.comforterSize ?? undefined,
        totalAmount:     preAuthCents,
        stripePaymentIntentId: paymentIntent,
        serviceType:     (meta.serviceType as "comforter_wash" | "wash_fold" | "wash_only") ?? "comforter_wash",
        pounds:          meta.pounds ? parseFloat(meta.pounds) : undefined,
        numBags:         meta.numBags ? parseInt(meta.numBags) : undefined,
        preAuthCents,
        subscriptionFrequency: frequency,
        pricePerLbCents: meta.pricePerLbCents ? parseInt(meta.pricePerLbCents) : undefined,
        promoCode:           meta.promoCode ?? undefined,
        promoDiscountCents:  meta.promoDiscountCents ? parseInt(meta.promoDiscountCents) : undefined,
        tipCents:            meta.tipCents ? parseInt(meta.tipCents) : undefined,
        deliveryFeeCents:    meta.deliveryFeeCents ? parseInt(meta.deliveryFeeCents) : undefined,
      })

      // ── If this is a recurring booking, create Stripe Customer + subscription ──
      if (frequency !== "one_time" && meta.recurringPickupDay && booking?.id) {
        await createSubscription({
          bookingId:             booking.id,
          customerName:          meta.customerName,
          customerEmail:         meta.customerEmail,
          customerPhone:         meta.customerPhone,
          customerAddress:       meta.address,
          frequency:             frequency as "weekly" | "biweekly",
          pickupDayOfWeek:       meta.recurringPickupDay,
          pickupTimeWindow:      meta.recurringPickupTime ?? meta.pickupTimeWindow,
          deliveryDayOfWeek:     meta.recurringDeliveryDay,
          deliveryTimeWindow:    meta.recurringDeliveryTime ?? meta.deliveryTimeWindow,
          pricePerLbCents:       meta.pricePerLbCents ? parseInt(meta.pricePerLbCents) : 225,
          detergent:             meta.detergent ?? "standard",
          fabricSoftener:        meta.fabricSoftener === "true",
          oxiClean:              meta.oxiClean === "true",
          colorSafeBleach:       meta.colorSafeBleach === "true",
          stripePaymentIntentId: paymentIntent,
          firstPickupDateStr:    meta.pickupDate,
          firstDeliveryDateStr:  meta.deliveryDate,
        }).catch(err => console.error("[stripe] createSubscription failed:", err))
      }

      // ── Send confirmation emails (fire-and-forget, don't block payment) ──
      if (meta.customerEmail) {
        const estimatedTotal = `$${(preAuthCents / 100).toFixed(2)}`
        const emailData = {
          customerName:    meta.customerName ?? "Customer",
          customerEmail:   meta.customerEmail,
          serviceType:     meta.serviceType ?? "comforter_wash",
          pickupDate:      meta.pickupDate ?? "",
          pickupTimeWindow: meta.pickupTimeWindow ?? "",
          deliveryDate:    meta.deliveryDate ?? "",
          deliveryTimeWindow: meta.deliveryTimeWindow ?? "",
          pickupAddress:   meta.address ?? "",
          numComforters:   meta.numComforters ? parseInt(meta.numComforters) : meta.quantity ? parseInt(meta.quantity) : 1,
          comforterSize:   meta.comforterSize ?? undefined,
          pounds:          meta.pounds ? parseFloat(meta.pounds) : undefined,
          estimatedTotal,
          bookingId:       booking?.id ?? "",
        }

        // Customer confirmation (don't await — keeps payment flow fast)
        sendBookingConfirmationEmail(emailData).catch(err =>
          console.error("[stripe] Customer confirmation email failed:", err)
        )

        // Admin new-order alert
        sendAdminNewOrderEmail({
          ...emailData,
          customerPhone:      meta.customerPhone ?? "",
          preAuthTotal:       estimatedTotal,
          subscriptionFrequency: frequency,
        }).catch(err =>
          console.error("[stripe] Admin alert email failed:", err)
        )
      }
    }

    return { success: true }
  } catch (error) {
    console.error("[stripe] handleSuccessfulPayment error:", error)
    return { success: false, error: "Failed to save booking" }
  }
}
turn { success: true }
  } catch (error) {
    console.error("[stripe] handleSuccessfulPayment error:", error)
    return { success: false, error: "Failed to save booking" }
  }
}
