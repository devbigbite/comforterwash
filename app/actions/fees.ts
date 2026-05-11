"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { stripe } from "@/lib/stripe"
import { revalidatePath } from "next/cache"

export type MiscFee = {
  id: string
  booking_id: string
  label: string
  amount_cents: number
  payment_url: string | null
  stripe_session_id: string | null
  status: "pending" | "paid" | "waived"
  notes: string | null
  created_by: string
  created_at: string
}

// ── Preset fee types ──────────────────────────────────────────────────────────
export const FEE_PRESETS = [
  { label: "Missed Pickup",      amount_cents: 1500 },
  { label: "Cancelled Pickup",   amount_cents: 1500 },
  { label: "Late Cancellation",  amount_cents: 1000 },
  { label: "Redelivery",        amount_cents: 1000 },
]

// ── Get all misc fees for an order ───────────────────────────────────────────
export async function getMiscFees(bookingId: string): Promise<MiscFee[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("misc_fees")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
  return (data ?? []) as MiscFee[]
}

// ── Charge a misc fee ─────────────────────────────────────────────────────────
// Creates a hosted Stripe Checkout session → returns a shareable payment URL
export async function chargeMiscFee(formData: FormData): Promise<{ error?: string; paymentUrl?: string }> {
  try {
    const bookingId   = formData.get("bookingId")   as string
    const label       = formData.get("label")       as string
    const amountCents = parseInt(formData.get("amountCents") as string, 10)
    const notes       = (formData.get("notes") as string | null) ?? null

    if (!bookingId || !label || !amountCents || amountCents < 50) {
      return { error: "Invalid fee — minimum $0.50" }
    }

    const supabase    = createAdminClient()
    const locationId  = await getLocationId()

    // Get customer info from booking
    const { data: booking } = await supabase
      .from("bookings")
      .select("customer_name, customer_email, id")
      .eq("id", bookingId)
      .single()

    if (!booking) return { error: "Booking not found" }

    const orderCode = booking.id.slice(0, 8).toUpperCase()

    // Create a hosted Stripe Checkout session (generates a shareable URL)
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: label,
              description: `Order ${orderCode} — ${booking.customer_name}`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      customer_email: booking.customer_email ?? undefined,
      metadata: {
        type: "misc_fee",
        bookingId,
        label,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://comforterwash.vercel.app"}/admin/orders/${bookingId}?fee_paid=1`,
      cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL ?? "https://comforterwash.vercel.app"}/admin/orders/${bookingId}`,
    })

    // Store the fee in the DB
    const { error: dbError } = await supabase.from("misc_fees").insert({
      booking_id:        bookingId,
      location_id:       locationId,
      label,
      amount_cents:      amountCents,
      payment_url:       session.url,
      stripe_session_id: session.id,
      status:            "pending",
      notes:             notes || null,
      created_by:        "admin",
    })

    if (dbError) return { error: dbError.message }

    // Log it on the order timeline
    await supabase.from("order_events").insert({
      booking_id:  bookingId,
      event_type:  "misc_fee_added",
      notes:       `${label}: $${(amountCents / 100).toFixed(2)} — payment link generated`,
      created_by:  "admin",
    })

    revalidatePath(`/admin/orders/${bookingId}`)
    return { paymentUrl: session.url! }

  } catch (err: unknown) {
    console.error("[fees] chargeMiscFee error:", err)
    return { error: err instanceof Error ? err.message : "Unknown error" }
  }
}

// ── Mark a fee as waived (no charge) ────────────────────────────────────────
export async function waiveMiscFee(feeId: string, bookingId: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("misc_fees")
    .update({ status: "waived" })
    .eq("id", feeId)

  if (error) return { error: error.message }

  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: "misc_fee_waived",
    notes:      `Fee waived by admin`,
    created_by: "admin",
  })

  revalidatePath(`/admin/orders/${bookingId}`)
  return {}
}

// ── Mark a fee as paid manually (e.g. cash/Venmo) ───────────────────────────
export async function markFeePaid(feeId: string, bookingId: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("misc_fees")
    .update({ status: "paid" })
    .eq("id", feeId)

  if (error) return { error: error.message }

  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: "misc_fee_paid",
    notes:      `Fee marked paid manually by admin`,
    created_by: "admin",
  })

  revalidatePath(`/admin/orders/${bookingId}`)
  return {}
}
