"use server"

import Stripe from "stripe"
import { createAdminClient } from "@/lib/supabase/admin"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-04-10" })

// Day-of-week → JS getDay() number
const DAY_NUMS: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5,
}

/** Returns the next calendar date for a given weekday ID, starting from `after` (exclusive). */
function nextOccurrence(dayId: string, after: Date = new Date()): Date {
  const target = DAY_NUMS[dayId]
  const base = new Date(after)
  base.setHours(0, 0, 0, 0)
  const todayNum = base.getDay()
  let diff = target - todayNum
  if (diff <= 0) diff += 7
  const result = new Date(base)
  result.setDate(base.getDate() + diff)
  return result
}

/** Calculates the next pickup date after a given delivery date, based on frequency. */
function nextPickupAfter(deliveryDate: Date, pickupDayId: string, frequency: string): Date {
  // For weekly: next occurrence of pickup day after delivery date
  // For biweekly: occurrence 2 weeks after delivery date
  const next = nextOccurrence(pickupDayId, deliveryDate)
  if (frequency === "biweekly") {
    next.setDate(next.getDate() + 7)
  }
  return next
}

/**
 * Called after a successful Stripe payment for a recurring (weekly/biweekly) order.
 * - Creates a Stripe Customer and attaches their payment method
 * - Inserts a subscription record in the DB
 * - Schedules next_pickup_date
 */
export async function createSubscription(params: {
  bookingId:             string
  customerName:          string
  customerEmail:         string
  customerPhone:         string
  customerAddress:       string
  frequency:             "weekly" | "biweekly"
  pickupDayOfWeek:       string
  pickupTimeWindow:      string
  deliveryDayOfWeek:     string
  deliveryTimeWindow:    string
  pricePerLbCents:       number
  detergent:             string
  fabricSoftener:        boolean
  oxiClean:              boolean
  colorSafeBleach:       boolean
  stripePaymentIntentId: string
  firstPickupDateStr:    string   // ISO string of first pickup date
  firstDeliveryDateStr:  string   // ISO string of first delivery date
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()

    // ── 1. Retrieve PaymentIntent to get payment method ──────────────────────
    const pi = await stripe.paymentIntents.retrieve(params.stripePaymentIntentId, {
      expand: ["payment_method"],
    })
    const pmId = typeof pi.payment_method === "string"
      ? pi.payment_method
      : pi.payment_method?.id

    // ── 2. Create Stripe Customer ────────────────────────────────────────────
    const customer = await stripe.customers.create({
      name:  params.customerName,
      email: params.customerEmail,
      phone: params.customerPhone,
      metadata: {
        address: params.customerAddress,
        frequency: params.frequency,
      },
    })

    // ── 3. Attach payment method to customer ─────────────────────────────────
    if (pmId) {
      await stripe.paymentMethods.attach(pmId, { customer: customer.id })
      await stripe.customers.update(customer.id, {
        invoice_settings: { default_payment_method: pmId },
      })
    }

    // ── 4. Calculate next pickup date ────────────────────────────────────────
    const firstDelivery  = new Date(params.firstDeliveryDateStr)
    const nextPickup     = nextPickupAfter(firstDelivery, params.pickupDayOfWeek, params.frequency)
    const nextPickupDate = nextPickup.toISOString().split("T")[0]

    // ── 5. Insert subscription record ────────────────────────────────────────
    const { error } = await supabase.from("subscriptions").insert({
      customer_name:           params.customerName,
      customer_email:          params.customerEmail,
      customer_phone:          params.customerPhone,
      customer_address:        params.customerAddress,
      frequency:               params.frequency,
      pickup_day_of_week:      params.pickupDayOfWeek,
      pickup_time_window:      params.pickupTimeWindow,
      delivery_day_of_week:    params.deliveryDayOfWeek,
      delivery_time_window:    params.deliveryTimeWindow,
      price_per_lb_cents:      params.pricePerLbCents,
      detergent:               params.detergent,
      fabric_softener:         params.fabricSoftener,
      oxi_clean:               params.oxiClean,
      color_safe_bleach:       params.colorSafeBleach,
      stripe_customer_id:      customer.id,
      stripe_payment_method_id: pmId ?? null,
      status:                  "active",
      next_pickup_date:        nextPickupDate,
      first_booking_id:        params.bookingId,
    })

    if (error) throw error

    return { ok: true }
  } catch (err: unknown) {
    console.error("[createSubscription]", err)
    return { ok: false, error: (err as Error).message }
  }
}

// ─── Admin actions ────────────────────────────────────────────────────────────

export async function pauseSubscription(id: string) {
  "use server"
  const supabase = createAdminClient()
  await supabase.from("subscriptions").update({ status: "paused" }).eq("id", id)
}

export async function resumeSubscription(id: string) {
  "use server"
  const supabase = createAdminClient()
  await supabase.from("subscriptions").update({ status: "active" }).eq("id", id)
}

export async function cancelSubscription(id: string) {
  "use server"
  const supabase = createAdminClient()
  await supabase.from("subscriptions").update({ status: "cancelled" }).eq("id", id)
}
