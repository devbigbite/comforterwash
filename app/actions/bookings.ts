"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { sendBookingNotification } from "@/lib/sms"
import { createShipdayOrder } from "@/lib/shipday"
import { format } from "date-fns"
import { todayET } from "@/lib/date-et"

export interface BookingData {
  customerName: string
  customerEmail: string
  customerPhone: string
  customerAddress: string
  pickupDate: string
  pickupTimeWindow: string
  deliveryDate: string
  deliveryTimeWindow: string
  numComforters: number
  totalAmount: number
  stripePaymentIntentId?: string
  serviceType?: "comforter_wash" | "wash_fold" | "wash_only"
  pounds?: number
  numBags?: number
  preAuthCents?: number
  subscriptionFrequency?: string   // one_time | weekly | biweekly
  pricePerLbCents?: number         // locked-in rate at booking time
  comforterSize?: string           // twin | full | queen | king
  promoCode?: string
  promoDiscountCents?: number
  tipCents?: number
  deliveryFeeCents?: number
  isManualCapture?: boolean
  deliveryAddress?: string
  detergent?: string
  extras?: string
  comforterSizes?: string   // e.g. "Queen:1,King:2"
}

function toDateString(val: string): string {
  return new Date(val).toISOString().split("T")[0]
}

/** Generates a 6-digit numeric order code (100000–999999). Numeric-only = one keyboard on mobile. */
function generateShortCode(): string {
  return String(Math.floor(Math.random() * 900000) + 100000)
}

export async function createBooking(data: BookingData) {
  const supabase = createAdminClient()

  // Attach user_id if the customer is logged in
  let userId: string | null = null
  try {
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (user) userId = user.id
  } catch { /* not logged in — that's fine */ }

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      short_code: generateShortCode(),
      customer_name: data.customerName,
      customer_email: data.customerEmail,
      customer_phone: data.customerPhone,
      customer_address: data.customerAddress,
      pickup_date: toDateString(data.pickupDate),
      pickup_time_window: data.pickupTimeWindow,
      delivery_date: toDateString(data.deliveryDate),
      delivery_time_window: data.deliveryTimeWindow,
      num_comforters: data.numComforters,
      total_amount: data.totalAmount,
      stripe_payment_intent_id: data.stripePaymentIntentId,
      status: "confirmed",
      service_type: data.serviceType ?? "comforter_wash",
      pounds: data.pounds ?? null,
      num_bags: data.numBags ?? data.numComforters ?? 1,
      user_id: userId,
      pre_auth_cents: data.preAuthCents ?? null,
      payment_status: data.isManualCapture ? "pre_authorized" : "paid",
      subscription_frequency: data.subscriptionFrequency ?? "one_time",
      price_per_lb_cents: data.pricePerLbCents ?? null,
      comforter_size: data.comforterSize ?? null,
      promo_code: data.promoCode ?? null,
      promo_discount_cents: data.promoDiscountCents ?? 0,
      tip_cents: data.tipCents ?? 0,
      delivery_fee_cents: data.deliveryFeeCents ?? 0,
      delivery_address: data.deliveryAddress ?? null,
      detergent: data.detergent ?? null,
      extras: data.extras ?? null,
      comforter_sizes: data.comforterSizes ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error("[booking] Supabase insert failed:", error.message)
    throw new Error("Failed to create booking")
  }

  // Auto-create order bags
  try {
    const orderCode = booking.short_code ?? booking.id.slice(0, 6).toUpperCase()
    const numBags = data.numBags ?? data.numComforters ?? 1
    const bags = Array.from({ length: numBags }, (_, i) => ({
      booking_id: booking.id,
      bag_number: i + 1,
      label_code: `${orderCode}-B${i + 1}`,
      status: "pending",
    }))
    await supabase.from("order_bags").insert(bags)

    // Create initial booking_created event
    await supabase.from("order_events").insert({
      booking_id: booking.id,
      event_type: "booking_created",
      notes: `Order placed. ${numBags} bag${numBags > 1 ? "s" : ""} expected at pickup.`,
      created_by: "system",
    })
  } catch (bagErr) {
    console.error("[bags] Error creating order bags:", bagErr)
  }

  // Dispatch to Shipday and store the returned order IDs for future patching
  try {
    const { pickupOrderId, deliveryOrderId } = await createShipdayOrder({
      id: booking.id,
      short_code: booking.short_code ?? null,
      customer_name: booking.customer_name,
      customer_email: booking.customer_email,
      customer_phone: booking.customer_phone,
      customer_address: booking.customer_address,
      pickup_date: booking.pickup_date,
      pickup_time_window: booking.pickup_time_window,
      delivery_date: booking.delivery_date,
      delivery_time_window: booking.delivery_time_window,
      num_comforters: booking.num_comforters ?? 0,
      total_amount: booking.total_amount,
      service_type: booking.service_type as "comforter_wash" | "wash_fold",
      pounds: booking.pounds ?? undefined,
      num_bags: booking.num_bags ?? undefined,
    })

    // Persist IDs so admin can patch or reassign routes later
    if (pickupOrderId || deliveryOrderId) {
      await supabase
        .from("bookings")
        .update({
          shipday_pickup_order_id: pickupOrderId,
          shipday_delivery_order_id: deliveryOrderId,
        })
        .eq("id", booking.id)
    }
  } catch (error) {
    console.error("[shipday] Error dispatching order:", error)
  }

  // Send SMS confirmation
  try {
    const pickupDate = format(new Date(data.pickupDate), "MMMM d")
    await sendBookingNotification(booking.id, "booking_confirmed", data.customerName, pickupDate, data.pickupTimeWindow)
  } catch (error) {
    console.error("[v0] Error sending confirmation SMS:", error)
  }

  return booking
}

export async function getBookings() {
  const supabase = createAdminClient()

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching bookings:", error)
    throw new Error("Failed to fetch bookings")
  }

  return bookings
}

export async function updateBookingStatus(bookingId: string, status: string, notes?: string) {
  const supabase = createAdminClient()

  const updateData: Record<string, unknown> = { status }
  if (notes !== undefined) {
    updateData.notes = notes
  }

  const { data: booking, error } = await supabase
    .from("bookings")
    .update(updateData)
    .eq("id", bookingId)
    .select()
    .single()

  if (error) {
    console.error("[v0] Error updating booking:", error)
    throw new Error("Failed to update booking")
  }

  try {
    const customerName = booking.customer_name
    const deliveryDate = format(new Date(booking.delivery_date), "MMMM d")
    const deliveryTime = booking.delivery_time_window

    switch (status) {
      case "picked_up":
        await sendBookingNotification(bookingId, "picked_up", customerName, deliveryDate)
        break
      case "out_for_delivery":
        await sendBookingNotification(bookingId, "out_for_delivery", customerName, deliveryTime)
        break
      case "delivered":
        await sendBookingNotification(bookingId, "delivered", customerName)
        break
    }
  } catch (error) {
    console.error("[v0] Error sending status SMS:", error)
  }

  return booking
}

export async function getBookingsByDate(date: string) {
  const supabase = createAdminClient()

  const { data: pickups, error: pickupError } = await supabase
    .from("bookings")
    .select("*")
    .eq("pickup_date", date)
    .in("status", ["confirmed", "pending"])
    .order("pickup_time_window", { ascending: true })

  if (pickupError) {
    console.error("[v0] Error fetching pickups:", pickupError)
    throw new Error("Failed to fetch pickups")
  }

  const { data: deliveries, error: deliveryError } = await supabase
    .from("bookings")
    .select("*")
    .eq("delivery_date", date)
    .in("status", ["in_progress", "out_for_delivery"])
    .order("delivery_time_window", { ascending: true })

  if (deliveryError) {
    console.error("[v0] Error fetching deliveries:", deliveryError)
    throw new Error("Failed to fetch deliveries")
  }

  return { pickups: pickups || [], deliveries: deliveries || [] }
}

export async function getUpcomingDates() {
  const supabase = createAdminClient()

  const today = todayET()

  const { data: pickupDates, error: pickupError } = await supabase
    .from("bookings")
    .select("pickup_date")
    .gte("pickup_date", today)
    .in("status", ["confirmed", "pending"])
    .order("pickup_date", { ascending: true })

  const { data: deliveryDates, error: deliveryError } = await supabase
    .from("bookings")
    .select("delivery_date")
    .gte("delivery_date", today)
    .in("status", ["in_progress", "out_for_delivery"])
    .order("delivery_date", { ascending: true })

  if (pickupError || deliveryError) {
    console.error("[v0] Error fetching dates:", pickupError || deliveryError)
    throw new Error("Failed to fetch dates")
  }

  const allDates = new Set([
    ...(pickupDates?.map((d) => d.pickup_date) || []),
    ...(deliveryDates?.map((d) => d.delivery_date) || []),
  ])

  return Array.from(allDates).sort()
}
