"use server"

import { stripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"
import { createBooking } from "./bookings"
import { createSubscription } from "./subscriptions"
import { sendBookingConfirmationEmail, sendAdminNewOrderEmail } from "@/lib/email"
import { getLocationId } from "@/lib/location"
import { getConnectStatusForLocation, isCheckoutBlockedByConnectRequirement } from "@/lib/stripe-connect"
import { recordCheckoutAttempt, markCheckoutAttemptSucceeded } from "./checkout-attempts"
import { createGiftCardFromPurchase, redeemGiftCard } from "./gift-cards"

// Only route money to the tenant's own bank account once they've actually
// finished Stripe onboarding (status === "active"). Anything else — not
// connected, or mid-setup — falls back to the shared platform account exactly
// as it always has, so nothing breaks for tenants who haven't connected yet.
async function connectDestinationFor(locationId: string): Promise<string | undefined> {
  try {
    const { status, accountId } = await getConnectStatusForLocation(locationId)
    return status === "active" && accountId ? accountId : undefined
  } catch {
    return undefined
  }
}

// ── Checkout session ──────────────────────────────────────────────────────────
// amountCents: the pre-auth ceiling (already includes 25% buffer for wash-fold)
// manualCapture: if true, only authorizes — you must call capturePayment() later
export async function startCheckoutSession(
  amountCents: number,
  label: string,
  metadata?: Record<string, string>,
  manualCapture = false
) {
  const locationId = await getLocationId()

  // Tenants past their grandfather window must finish their own Stripe
  // onboarding before this site can take a real charge — see
  // lib/stripe-connect.ts. Returns a typed error instead of throwing so the
  // Checkout component can show a friendly message rather than a crash.
  if (await isCheckoutBlockedByConnectRequirement(locationId)) {
    return {
      error: "This business hasn't finished setting up online payments yet. Please check back soon, or contact them directly to book.",
    }
  }

  const destination = await connectDestinationFor(locationId)

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
      ...(destination ? { transfer_data: { destination } } : {}),
    },
    metadata: metadata ?? {},
  })

  // Record this attempt the moment the customer reaches checkout — before
  // they've necessarily paid. Without this, a declined card or an abandoned
  // checkout leaves zero trace anywhere (no booking is created until payment
  // succeeds), so staff have no way to follow up on an order the customer
  // clearly intended to place. Never blocks checkout on failure.
  recordCheckoutAttempt({
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
    amountCents,
    metadata: metadata ?? {},
  })

  return { clientSecret: session.client_secret!, sessionId: session.id }
}

// Lightweight pre-check so the Checkout component can avoid ever mounting the
// embedded Stripe form when the tenant hasn't finished Connect onboarding —
// startCheckoutSession itself also re-checks (defense in depth), but that
// would mean creating a real Stripe Checkout Session just to reject it.
export async function checkCheckoutAllowed(): Promise<boolean> {
  const locationId = await getLocationId()
  return !(await isCheckoutBlockedByConnectRequirement(locationId))
}

// ── Capture actual payment after weight is confirmed ──────────────────────────
// If actual amount exceeds the pre-auth ceiling, the overage is charged
// immediately to the saved payment method as a second PaymentIntent.
export async function capturePayment(bookingId: string) {
  const supabase = createAdminClient()
  const { data: booking } = await supabase
    .from("bookings")
    .select("stripe_payment_intent_id, customer_final_cents, pre_auth_cents, stripe_customer_id, stripe_payment_method_id, actual_weight_lbs, customer_email, location_id")
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

  // ── Increment monthly plan usage ────────────────────────────────────────────
  // Only increments when the booking is explicitly linked to a plan subscription
  // via plan_subscription_id — prevents one-time bookings from the same email
  // from polluting the monthly cycle counter.
  if (booking.actual_weight_lbs && booking.plan_subscription_id) {
    try {
      const { data: planSub } = await supabase
        .from("subscriptions")
        .select("id, lbs_used_this_cycle")
        .eq("id", booking.plan_subscription_id)
        .eq("subscription_type", "monthly_plan")
        .eq("status", "active")
        .single()

      if (planSub) {
        const newLbs = (planSub.lbs_used_this_cycle ?? 0) + booking.actual_weight_lbs
        await supabase
          .from("subscriptions")
          .update({ lbs_used_this_cycle: newLbs })
          .eq("id", planSub.id)
        console.log(`[stripe] Plan usage updated: ${newLbs} lbs (added ${booking.actual_weight_lbs} lbs) — sub ${planSub.id}`)
      }
    } catch {
      // Non-fatal: don't block payment capture if usage tracking fails
    }
  }

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
      const overageDestination = booking.location_id
        ? await connectDestinationFor(booking.location_id)
        : undefined

      const overagePI = await stripe.paymentIntents.create({
        amount:         overageCents,
        currency:       "usd",
        customer:       customerId ?? undefined,
        payment_method: pmId,
        confirm:        true,
        off_session:    true,
        description:    `Weight overage charge — booking ${bookingId}`,
        metadata:       { bookingId, type: "weight_overage" },
        ...(overageDestination ? { transfer_data: { destination: overageDestination } } : {}),
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

// ── Charge a commercial account's saved card at weigh-in ─────────────────────
// Commercial pay-at-time-of-service orders never get a consumer-style
// pre-auth at booking time (there's no checkout session) — the entire
// customer_final_cents amount is charged off-session against the account's
// saved card the moment weight is entered. Mirrors the overage-charge shape
// in capturePayment() above, but for the full amount instead of just the
// portion past a pre-auth ceiling. Failures are surfaced (not swallowed) via
// the returned {error} so the operator UI can show it instead of silently
// leaving the order unpaid — see the storage-space silent-failure lesson.
export async function chargeCommercialAccountOrder(bookingId: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = createAdminClient()
  const { data: booking } = await supabase
    .from("bookings")
    .select("commercial_account_id, customer_final_cents, location_id")
    .eq("id", bookingId)
    .single()

  if (!booking?.commercial_account_id) return { error: "Booking is not linked to a commercial account" }

  const finalCents = booking.customer_final_cents
  if (!finalCents) return { error: "No final amount set — enter weight first" }

  const { data: account } = await supabase
    .from("commercial_accounts")
    .select("id, business_name, stripe_customer_id, stripe_payment_method_id")
    .eq("id", booking.commercial_account_id)
    .single()

  if (!account?.stripe_customer_id || !account?.stripe_payment_method_id) {
    return { error: `${account?.business_name ?? "This commercial account"} has no payment method on file yet — add a card before charging.` }
  }

  try {
    const destination = booking.location_id ? await connectDestinationFor(booking.location_id) : undefined

    const pi = await stripe.paymentIntents.create({
      amount: finalCents,
      currency: "usd",
      customer: account.stripe_customer_id,
      payment_method: account.stripe_payment_method_id,
      confirm: true,
      off_session: true,
      description: `Commercial order charge — ${account.business_name} — booking ${bookingId}`,
      metadata: { bookingId, commercialAccountId: account.id, type: "commercial_pay_at_service" },
      ...(destination ? { transfer_data: { destination } } : {}),
    })

    await supabase.from("bookings").update({
      stripe_payment_intent_id: pi.id,
      payment_status: pi.status === "succeeded" ? "captured" : "pending",
    }).eq("id", bookingId)

    if (pi.status !== "succeeded") {
      return { error: `Charge did not complete — Stripe status: ${pi.status}` }
    }
    return { success: true }
  } catch (err) {
    console.error("[stripe] chargeCommercialAccountOrder failed:", err)
    await supabase.from("bookings").update({ payment_status: "failed" }).eq("id", bookingId)
    return { error: err instanceof Error ? err.message : "Charge failed" }
  }
}

// ── Charge a residential weekly/biweekly subscriber's saved card at weigh-in ─
// The FIRST pickup of a per-pickup subscription is paid the normal consumer
// way (pre-auth at checkout, captured here via capturePayment). Every pickup
// after that is auto-generated by the recurring engine (see
// app/actions/recurring-engine.ts) with no checkout session at all — so it
// has no stripe_payment_intent_id yet. This charges the subscription's saved
// card off-session for the full amount, the moment weight is entered.
// Mirrors chargeCommercialAccountOrder's shape exactly.
export async function chargeSubscriptionOrder(bookingId: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = createAdminClient()
  const { data: booking } = await supabase
    .from("bookings")
    .select("recurring_subscription_id, customer_final_cents, location_id")
    .eq("id", bookingId)
    .single()

  if (!booking?.recurring_subscription_id) return { error: "Booking is not linked to a subscription" }

  const finalCents = booking.customer_final_cents
  if (!finalCents) return { error: "No final amount set — enter weight first" }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, customer_name, stripe_customer_id, stripe_payment_method_id")
    .eq("id", booking.recurring_subscription_id)
    .single()

  if (!sub?.stripe_customer_id || !sub?.stripe_payment_method_id) {
    return { error: `${sub?.customer_name ?? "This subscriber"} has no payment method on file — cannot charge.` }
  }

  try {
    const destination = booking.location_id ? await connectDestinationFor(booking.location_id) : undefined

    const pi = await stripe.paymentIntents.create({
      amount: finalCents,
      currency: "usd",
      customer: sub.stripe_customer_id,
      payment_method: sub.stripe_payment_method_id,
      confirm: true,
      off_session: true,
      description: `Recurring subscription order charge — ${sub.customer_name} — booking ${bookingId}`,
      metadata: { bookingId, subscriptionId: sub.id, type: "subscription_pay_at_service" },
      ...(destination ? { transfer_data: { destination } } : {}),
    })

    await supabase.from("bookings").update({
      stripe_payment_intent_id: pi.id,
      payment_status: pi.status === "succeeded" ? "captured" : "pending",
    }).eq("id", bookingId)

    if (pi.status !== "succeeded") {
      return { error: `Charge did not complete — Stripe status: ${pi.status}` }
    }
    return { success: true }
  } catch (err) {
    console.error("[stripe] chargeSubscriptionOrder failed:", err)
    await supabase.from("bookings").update({ payment_status: "failed" }).eq("id", bookingId)
    return { error: err instanceof Error ? err.message : "Charge failed" }
  }
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
    // Idempotency guard — this is triggered by Stripe Embedded Checkout's
    // client-side onComplete callback (see components/checkout.tsx), which
    // has no built-in dedup: a re-render, flaky network retry, or a customer
    // re-triggering completion could call this twice for the same session.
    // Without this check, a second call would create a duplicate booking,
    // re-redeem an applied gift card (double-spending its balance), and
    // re-create a recurring subscription. checkout_attempts already tracks
    // exactly one row per session and only ever moves pending -> succeeded
    // once (see markCheckoutAttemptSucceeded) - reuse it as the source of
    // truth for "has this session already been processed."
    const adminSupabase = createAdminClient()
    const { data: existingAttempt } = await adminSupabase
      .from("checkout_attempts")
      .select("status, booking_id")
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle()

    if (existingAttempt?.status === "succeeded") {
      if (existingAttempt.booking_id) {
        return { success: true, bookingId: existingAttempt.booking_id }
      }
      // Gift-card purchases succeed without a booking_id -- look up the
      // card issued for this exact session instead of re-creating one.
      const { data: card } = await adminSupabase
        .from("gift_cards")
        .select("code")
        .eq("stripe_checkout_session_id", sessionId)
        .maybeSingle()
      return { success: true, giftCardCode: card?.code }
    }

    // NOTE: `payment_intent_data` (where capture_method: "manual" was set) is
    // an input-only param on session CREATE — it is never echoed back on
    // retrieve, so checking it here always evaluated to undefined and
    // `isManual` was always false. For manual-capture (pre-auth) sessions,
    // Stripe also never sets session.payment_status to "paid" — it stays
    // "unpaid" until the PaymentIntent is actually captured later at
    // weigh-in. Combined, the old condition below was always false for every
    // manual-capture booking, so this function silently skipped creating the
    // booking entirely while still returning { success: true } — the
    // customer saw "Payment authorized!" for an order that was never saved.
    // Fix: expand the actual PaymentIntent and check ITS status —
    // "requires_capture" is what a successful manual-capture authorization
    // looks like; "succeeded" covers normal auto-capture payments.
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] })
    const pi = typeof session.payment_intent === "object" ? session.payment_intent : null
    const isManual = pi?.capture_method === "manual"
    const paymentConfirmed =
      session.payment_status === "paid" ||
      pi?.status === "requires_capture" ||
      pi?.status === "succeeded"

    if (paymentConfirmed && session.metadata) {
      const meta = session.metadata

      // ── Gift card purchase — a completely separate flow from booking
      // checkout. No booking is created; instead a gift_cards row is issued
      // and delivered by email. Bail out early so the booking-creation logic
      // below never runs for these sessions. ──────────────────────────────
      if (meta.type === "gift_card") {
        const result = await createGiftCardFromPurchase({
          amountCents:      session.amount_total ?? 0,
          purchaserName:    meta.purchaserName || undefined,
          purchaserEmail:   meta.purchaserEmail || undefined,
          recipientName:    meta.recipientName || undefined,
          recipientEmail:   meta.recipientEmail || undefined,
          message:          meta.message || undefined,
          stripeCheckoutSessionId: sessionId,
        })
        // Mark the funnel attempt as succeeded without a booking_id — gift
        // card purchases never create a booking, so there's nothing to link.
        await createAdminClient()
          .from("checkout_attempts")
          .update({ status: "succeeded", updated_at: new Date().toISOString() })
          .eq("stripe_checkout_session_id", sessionId)
        if ("error" in result) return { success: false, error: result.error }
        return { success: true, giftCardCode: result.code }
      }

      const preAuthCents  = session.amount_total ?? 0
      const frequency     = meta.subscriptionFrequency ?? "one_time"
      const paymentIntent = pi?.id ?? (session.payment_intent as string)

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
        deliveryFeeCents:    meta.deliveryFeeCents ? parseInt(meta.deliveryFeeCents) : undefined,
        deliveryAddress:     meta.deliveryAddress ?? undefined,
        detergent:           meta.detergent ?? undefined,
        extras:              meta.extras ?? undefined,
        comforterSizes:      meta.comforterSizes ?? undefined,
        specialInstructions: meta.specialInstructions ?? undefined,
      })

      // ── Save payment method for future overage charges ──────────────────────
      if (booking?.id) {
        saveBookingPaymentMethod(booking.id, paymentIntent, meta.customerName ?? "", meta.customerEmail).catch(
          err => console.error("[stripe] saveBookingPaymentMethod failed:", err)
        )
        markCheckoutAttemptSucceeded(sessionId, booking.id).catch(
          err => console.error("[stripe] markCheckoutAttemptSucceeded failed:", err)
        )

        // ── Redeem any gift card applied at checkout — only now that payment
        // has actually succeeded, never at quote time in the booking form. ──
        if (meta.giftCardCode && meta.giftCardDiscountCents) {
          redeemGiftCard(meta.giftCardCode, parseInt(meta.giftCardDiscountCents), booking.id).catch(
            err => console.error("[stripe] redeemGiftCard failed:", err)
          )
        }
      }

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
          comforterSizes:  meta.comforterSizes ?? undefined,
          pounds:          meta.pounds ? parseFloat(meta.pounds) : undefined,
          estimatedTotal,
          bookingId:       booking?.id ?? "",
          shortCode:       booking?.short_code ?? undefined,
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

        // Auto-create account for new recurring subscribers
        const isRecurring = frequency === "weekly" || frequency === "biweekly"
        if (isRecurring && meta.customerEmail && meta.customerName) {
          import("@/app/actions/customer-auth").then(({ createAccountForSubscriber }) =>
            createAccountForSubscriber(
              meta.customerEmail!,
              meta.customerName!,
              meta.customerPhone ?? "",
            ).catch(err => console.error("[stripe] createAccountForSubscriber failed:", err))
          )
        }
      }

      return { success: true }
    }

    // Payment genuinely hasn't gone through yet (e.g. this fired before
    // Stripe finished confirming) — previously this fell through to an
    // unconditional `return { success: true }` below, which told the
    // customer "Payment authorized!" while silently never creating the
    // booking. Surface it as a failure instead so Checkout shows an error
    // and nothing is falsely confirmed.
    return { success: false, error: "Payment not yet confirmed — please try again in a moment." }
  } catch (error) {
    console.error("[stripe] handleSuccessfulPayment error:", error)
    return { success: false, error: "Failed to save booking" }
  }
}
