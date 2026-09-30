"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { stripe } from "@/lib/stripe"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth-guard"
import { directChargeAccountFor, acctOpts } from "@/lib/stripe-connect"

export type MiscFee = {
  id: string
  booking_id: string
  label: string
  amount_cents: number
  payment_url: string | null
  stripe_session_id: string | null
  stripe_payment_intent_id?: string | null
  status: "pending" | "paid" | "waived" | "failed"
  notes: string | null
  created_by: string
  created_at: string
}

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

// ── Charge a misc fee directly to the card on file ──────────────────────────
// A payment link only collects if the customer bothers to click and pay it --
// for something like a missed-pickup fee, that's effectively "this will
// probably go uncollected." Same off-session charge pattern chargeHangerAddon
// (app/actions/stripe.ts) already uses: pull the saved payment method (or
// recover it from the original booking PaymentIntent if nothing was saved
// yet), charge it immediately, and record the real outcome -- paid or failed
// -- instead of a "pending" link sitting unpaid indefinitely.
export async function chargeMiscFeeToCardOnFile(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  await requireAdmin()
  try {
    const bookingId   = formData.get("bookingId")   as string
    const label       = formData.get("label")       as string
    const amountCents = parseInt(formData.get("amountCents") as string, 10)
    const notes       = (formData.get("notes") as string | null) ?? null

    if (!bookingId || !label || !amountCents || amountCents < 50) {
      return { error: "Invalid fee — minimum $0.50" }
    }

    const supabase   = createAdminClient()
    const locationId = await getLocationId()

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, customer_name, customer_email, location_id, commercial_account_id, stripe_customer_id, stripe_payment_method_id, stripe_payment_intent_id")
      .eq("id", bookingId)
      .single()

    if (!booking) return { error: "Booking not found" }

    let pmId = booking.stripe_payment_method_id
    let customerId = booking.stripe_customer_id
    let opts: { stripeAccount: string } | undefined
    let commercialName: string | null = null

    if (booking.commercial_account_id) {
      // Commercial accounts keep their saved card on the platform account,
      // same scope chargeHangerAddon uses for them -- a direct charge on the
      // tenant's connected account can't see it.
      const { data: account } = await supabase
        .from("commercial_accounts")
        .select("stripe_customer_id, stripe_payment_method_id, business_name")
        .eq("id", booking.commercial_account_id)
        .single()
      pmId = account?.stripe_payment_method_id ?? null
      customerId = account?.stripe_customer_id ?? null
      commercialName = account?.business_name ?? null
      opts = undefined
    } else {
      const acct = booking.location_id ? await directChargeAccountFor(booking.location_id) : null
      opts = acctOpts(acct)

      if (!pmId && booking.stripe_payment_intent_id) {
        const originalPI = await stripe.paymentIntents.retrieve(
          booking.stripe_payment_intent_id,
          { expand: ["payment_method"] },
          opts,
        )
        pmId = typeof originalPI.payment_method === "string"
          ? originalPI.payment_method
          : (originalPI.payment_method as { id: string } | null)?.id ?? null
      }
    }

    if (!pmId) {
      return { error: `No card on file for ${commercialName ?? booking.customer_name ?? "this customer"} — cannot charge directly. Add a card or waive this fee instead.` }
    }

    if (pmId && !customerId && !booking.commercial_account_id) {
      const cust = await stripe.customers.create({
        name: booking.customer_name ?? undefined,
        email: booking.customer_email ?? undefined,
        payment_method: pmId,
      }, opts)
      customerId = cust.id
      await supabase.from("bookings").update({
        stripe_customer_id: customerId,
        stripe_payment_method_id: pmId,
      }).eq("id", bookingId)
    }

    const orderCode = booking.id.slice(0, 8).toUpperCase()
    let pi
    try {
      pi = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: "usd",
        customer: customerId ?? undefined,
        payment_method: pmId,
        confirm: true,
        off_session: true,
        description: `${label} — order ${orderCode}${commercialName ? ` — ${commercialName}` : ""}`,
        metadata: { type: "misc_fee", bookingId, label },
      }, opts)
    } catch (err) {
      console.error("[fees] chargeMiscFeeToCardOnFile charge failed:", err)
      const message = err instanceof Error ? err.message : "Charge failed"
      await supabase.from("misc_fees").insert({
        booking_id: bookingId, location_id: locationId, label, amount_cents: amountCents,
        payment_url: null, stripe_session_id: null, status: "failed", notes: notes || null, created_by: "admin",
      })
      await supabase.from("order_events").insert({
        booking_id: bookingId, event_type: "misc_fee_charge_failed",
        notes: `${label}: $${(amountCents / 100).toFixed(2)} — card charge failed: ${message}`, created_by: "admin",
      })
      revalidatePath(`/admin/orders/${bookingId}`)
      return { error: `Card charge failed: ${message}` }
    }

    const succeeded = pi.status === "succeeded"
    const { error: dbError } = await supabase.from("misc_fees").insert({
      booking_id: bookingId,
      location_id: locationId,
      label,
      amount_cents: amountCents,
      payment_url: null,
      stripe_session_id: null,
      stripe_payment_intent_id: pi.id,
      status: succeeded ? "paid" : "failed",
      notes: notes || null,
      created_by: "admin",
    })
    if (dbError) return { error: dbError.message }

    await supabase.from("order_events").insert({
      booking_id: bookingId,
      event_type: succeeded ? "misc_fee_charged" : "misc_fee_charge_failed",
      notes: `${label}: $${(amountCents / 100).toFixed(2)} — ${succeeded ? "charged to card on file" : `charge did not complete (Stripe status: ${pi.status})`}`,
      created_by: "admin",
    })

    revalidatePath(`/admin/orders/${bookingId}`)
    if (!succeeded) return { error: `Charge did not complete — Stripe status: ${pi.status}` }
    return { success: true }

  } catch (err: unknown) {
    console.error("[fees] chargeMiscFeeToCardOnFile error:", err)
    return { error: err instanceof Error ? err.message : "Unknown error" }
  }
}

// ── Charge a misc fee ─────────────────────────────────────────────────────────
// Creates a hosted Stripe Checkout session → returns a shareable payment URL
export async function chargeMiscFee(formData: FormData): Promise<{ error?: string; paymentUrl?: string }> {
  await requireAdmin()
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
  await requireAdmin()
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
  await requireAdmin()
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
