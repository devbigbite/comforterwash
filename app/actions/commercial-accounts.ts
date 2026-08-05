"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { stripe } from "@/lib/stripe"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

export interface CommercialAccount {
  id: string
  location_id: string
  business_name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  address: string | null
  billing_frequency: "weekly" | "biweekly" | "monthly"
  rate_type: "per_lb" | "flat" | "per_load"
  rate_amount_cents: number | null
  minimum_amount_cents: number | null
  notes: string | null
  status: "pending" | "active" | "paused" | "cancelled"
  access_code: string
  agreement_version: string
  agreement_signed_at: string | null
  agreement_signed_name: string | null
  agreement_signed_ip: string | null
  stripe_customer_id: string | null
  stripe_payment_method_id: string | null
  card_brand: string | null
  card_last4: string | null
  created_at: string
}

export interface CommercialInvoice {
  id: string
  commercial_account_id: string
  amount_cents: number
  period_from: string | null
  period_to: string | null
  notes: string | null
  stripe_invoice_id: string | null
  status: string
  created_at: string
}

// ── Admin CRUD ────────────────────────────────────────────────────────────────

export async function addCommercialAccount(formData: FormData) {
  await requireAdmin()
  const supabase = createAdminClient()
  const locationId = await getLocationId()

  const business_name = (formData.get("business_name") as string)?.trim()
  if (!business_name) return { error: "Business name is required" }

  const { error } = await supabase.from("commercial_accounts").insert({
    location_id: locationId,
    business_name,
    contact_name: (formData.get("contact_name") as string)?.trim() || null,
    contact_email: (formData.get("contact_email") as string)?.trim() || null,
    contact_phone: (formData.get("contact_phone") as string)?.trim() || null,
    address: (formData.get("address") as string)?.trim() || null,
    billing_frequency: (formData.get("billing_frequency") as string) || "monthly",
    rate_type: (formData.get("rate_type") as string) || "per_lb",
    rate_amount_cents: Math.round(parseFloat(formData.get("rate_amount") as string) * 100) || null,
    minimum_amount_cents: Math.round(parseFloat(formData.get("minimum_amount") as string) * 100) || null,
    notes: (formData.get("notes") as string)?.trim() || null,
  })

  if (error) return { error: error.message }
  revalidatePath("/admin/commercial")
  return { success: true }
}

export async function updateCommercialAccount(formData: FormData) {
  await requireAdmin()
  const supabase = createAdminClient()
  const id = formData.get("id") as string
  const business_name = (formData.get("business_name") as string)?.trim()
  if (!id || !business_name) return { error: "Missing fields" }

  const { error } = await supabase.from("commercial_accounts").update({
    business_name,
    contact_name: (formData.get("contact_name") as string)?.trim() || null,
    contact_email: (formData.get("contact_email") as string)?.trim() || null,
    contact_phone: (formData.get("contact_phone") as string)?.trim() || null,
    address: (formData.get("address") as string)?.trim() || null,
    billing_frequency: (formData.get("billing_frequency") as string) || "monthly",
    rate_type: (formData.get("rate_type") as string) || "per_lb",
    rate_amount_cents: Math.round(parseFloat(formData.get("rate_amount") as string) * 100) || null,
    minimum_amount_cents: Math.round(parseFloat(formData.get("minimum_amount") as string) * 100) || null,
    notes: (formData.get("notes") as string)?.trim() || null,
  }).eq("id", id)

  if (error) return { error: error.message }
  revalidatePath("/admin/commercial")
  return { success: true }
}

export async function toggleCommercialAccountStatus(formData: FormData) {
  await requireAdmin()
  const supabase = createAdminClient()
  const id = formData.get("id") as string
  const newStatus = formData.get("new_status") as string
  await supabase.from("commercial_accounts").update({ status: newStatus }).eq("id", id)
  revalidatePath("/admin/commercial")
}

export async function deleteCommercialAccount(formData: FormData) {
  await requireAdmin()
  const supabase = createAdminClient()
  const id = formData.get("id") as string
  await supabase.from("commercial_accounts").delete().eq("id", id)
  revalidatePath("/admin/commercial")
}

export async function getCommercialAccounts(): Promise<CommercialAccount[]> {
  await requireAdmin()
  const supabase = createAdminClient()
  const locationId = await getLocationId()
  const { data } = await supabase
    .from("commercial_accounts")
    .select("*")
    .eq("location_id", locationId)
    .order("created_at", { ascending: false })
  return (data ?? []) as CommercialAccount[]
}

// ── Public agreement lookup + signing (no admin auth — code-gated) ───────────

export async function getCommercialAccountByCode(code: string): Promise<CommercialAccount | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("commercial_accounts")
    .select("*")
    .eq("access_code", code)
    .maybeSingle()
  return (data as CommercialAccount) ?? null
}

export async function signCommercialAgreement(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const code = formData.get("code") as string
  const signedName = (formData.get("signed_name") as string)?.trim()
  const agreed = formData.get("agreed") === "on"

  if (!code) return { error: "Missing account code" }
  if (!signedName) return { error: "Please type your full name to sign." }
  if (!agreed) return { error: "You must confirm you agree to the terms." }

  const supabase = createAdminClient()
  const { data: account } = await supabase
    .from("commercial_accounts")
    .select("id, location_id, business_name, contact_name, contact_email, stripe_customer_id, agreement_signed_at")
    .eq("access_code", code)
    .maybeSingle()

  if (!account) return { error: "Account not found." }
  if (account.agreement_signed_at) return { error: "This agreement has already been signed." }

  const hdrs = await headers()
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || null

  // Create a Stripe customer now so the account is ready for invoicing
  // as soon as the agreement is in place.
  let stripeCustomerId = account.stripe_customer_id
  if (!stripeCustomerId) {
    try {
      const customer = await stripe.customers.create({
        name: account.business_name,
        email: account.contact_email ?? undefined,
        metadata: { commercial_account_id: account.id, kind: "commercial_account" },
      })
      stripeCustomerId = customer.id
    } catch (err) {
      console.error("[signCommercialAgreement] Stripe customer creation failed:", err)
      // Don't block signing on Stripe — admin can retry from the account later.
    }
  }

  const { error } = await supabase
    .from("commercial_accounts")
    .update({
      agreement_signed_at: new Date().toISOString(),
      agreement_signed_name: signedName,
      agreement_signed_ip: ip,
      status: "active",
      stripe_customer_id: stripeCustomerId,
    })
    .eq("id", account.id)

  if (error) return { error: error.message }

  revalidatePath(`/commercial-agreement/${code}`)
  revalidatePath("/admin/commercial")
  return { success: true }
}

// ── Card on file (pay at time of service) ────────────────────────────────────
// Collects a card via a Stripe Embedded Checkout Session in `mode: "setup"` —
// same EmbeddedCheckoutProvider/EmbeddedCheckout pattern already used for
// consumer bookings (components/checkout.tsx), just saving a card instead of
// charging one. No money moves here; the card is charged later, off-session,
// when weight is entered at the operator weigh-in step.
export async function createCommercialCardSetupSession(accountId: string): Promise<{ clientSecret?: string; sessionId?: string; error?: string }> {
  const supabase = createAdminClient()
  const { data: account } = await supabase
    .from("commercial_accounts")
    .select("id, stripe_customer_id, business_name, contact_email")
    .eq("id", accountId)
    .maybeSingle()

  if (!account) return { error: "Account not found" }

  let stripeCustomerId = account.stripe_customer_id
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      name: account.business_name,
      email: account.contact_email ?? undefined,
      metadata: { commercial_account_id: account.id, kind: "commercial_account" },
    })
    stripeCustomerId = customer.id
    await supabase.from("commercial_accounts").update({ stripe_customer_id: stripeCustomerId }).eq("id", accountId)
  }

  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    redirect_on_completion: "never",
    mode: "setup",
    customer: stripeCustomerId,
    metadata: { commercial_account_id: accountId },
  })

  return { clientSecret: session.client_secret!, sessionId: session.id }
}

export async function saveCommercialCardFromSetupSession(sessionId: string, accountId: string): Promise<{ success?: boolean; error?: string; brand?: string; last4?: string }> {
  const supabase = createAdminClient()
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["setup_intent"] })
    const setupIntent = session.setup_intent
    const pmId = typeof setupIntent === "string"
      ? undefined
      : typeof setupIntent?.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent?.payment_method?.id

    if (!pmId) return { error: "No payment method returned from Stripe" }

    const pm = await stripe.paymentMethods.retrieve(pmId)
    const brand = pm.card?.brand ?? null
    const last4 = pm.card?.last4 ?? null

    const { data: account } = await supabase
      .from("commercial_accounts")
      .select("stripe_customer_id")
      .eq("id", accountId)
      .single()

    if (account?.stripe_customer_id) {
      await stripe.paymentMethods.attach(pmId, { customer: account.stripe_customer_id }).catch(() => {/* already attached */})
      await stripe.customers.update(account.stripe_customer_id, {
        invoice_settings: { default_payment_method: pmId },
      }).catch(() => {})
    }

    await supabase.from("commercial_accounts").update({
      stripe_payment_method_id: pmId,
      card_brand: brand,
      card_last4: last4,
    }).eq("id", accountId)

    revalidatePath("/admin/commercial")
    return { success: true, brand: brand ?? undefined, last4: last4 ?? undefined }
  } catch (err) {
    console.error("[saveCommercialCardFromSetupSession]", err)
    return { error: err instanceof Error ? err.message : "Failed to save card" }
  }
}

// ── Create a real order for a commercial account ─────────────────────────────
// Reuses createBooking() so commercial orders flow through the exact same
// pipeline as consumer orders (order_bags, Shipday dispatch, SMS, color-key
// assignment) — per explicit instruction: "It should work the same way a
// regular customer flows." No pre-auth is taken; the account's saved card is
// charged off-session at weigh-in instead (see chargeCommercialAccountOrder
// in app/actions/stripe.ts).
export async function createCommercialOrder(formData: FormData): Promise<{ success?: boolean; error?: string; bookingId?: string }> {
  await requireAdmin()
  const supabase = createAdminClient()
  const accountId = formData.get("account_id") as string

  const { data: account } = await supabase
    .from("commercial_accounts")
    .select("id, business_name, contact_name, contact_email, contact_phone, address, status, stripe_payment_method_id")
    .eq("id", accountId)
    .single()

  if (!account) return { error: "Account not found" }
  if (account.status !== "active") return { error: "Account is not active — the agreement must be signed first." }
  if (!account.stripe_payment_method_id) return { error: "No card on file for this account yet — add a payment method first." }

  const pickupDate = formData.get("pickup_date") as string
  const pickupTimeWindow = (formData.get("pickup_time_window") as string) || "9:00 AM - 12:00 PM"
  const deliveryDate = (formData.get("delivery_date") as string) || pickupDate
  const deliveryTimeWindow = (formData.get("delivery_time_window") as string) || "9:00 AM - 12:00 PM"
  const numBags = parseInt(formData.get("num_bags") as string) || 1
  const serviceType = (formData.get("service_type") as string) || "wash_fold"

  if (!pickupDate) return { error: "Pickup date is required" }

  try {
    const { createBooking } = await import("./bookings")
    const booking = await createBooking({
      customerName: account.contact_name || account.business_name,
      customerEmail: account.contact_email || "",
      customerPhone: account.contact_phone || "",
      customerAddress: account.address || "",
      pickupDate,
      pickupTimeWindow,
      deliveryDate,
      deliveryTimeWindow,
      numComforters: numBags,
      numBags,
      totalAmount: 0,
      serviceType: serviceType as "comforter_wash" | "wash_fold" | "wash_only",
      commercialAccountId: account.id,
      paymentStatusOverride: "pending_weight",
    })

    revalidatePath("/admin/commercial")
    revalidatePath("/admin/dispatch")
    return { success: true, bookingId: booking.id }
  } catch (err) {
    console.error("[createCommercialOrder]", err)
    return { error: err instanceof Error ? err.message : "Failed to create order" }
  }
}

// ── Billing: issue a manual invoice via Stripe ───────────────────────────────

export async function getCommercialInvoices(accountId: string): Promise<CommercialInvoice[]> {
  await requireAdmin()
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("commercial_invoices")
    .select("*")
    .eq("commercial_account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(24)
  return (data ?? []) as CommercialInvoice[]
}

export async function issueCommercialInvoice(formData: FormData): Promise<{ success?: boolean; error?: string }> {
  await requireAdmin()
  const supabase = createAdminClient()
  const accountId = formData.get("account_id") as string
  const amount = parseFloat(formData.get("amount") as string)
  const periodFrom = (formData.get("period_from") as string) || null
  const periodTo = (formData.get("period_to") as string) || null
  const notes = (formData.get("notes") as string)?.trim() || null

  if (!accountId || !amount || amount <= 0) return { error: "Enter a valid amount" }

  const { data: account } = await supabase
    .from("commercial_accounts")
    .select("id, location_id, business_name, stripe_customer_id, contact_email, status")
    .eq("id", accountId)
    .single()

  if (!account) return { error: "Account not found" }
  if (!account.stripe_customer_id) return { error: "No Stripe customer on file yet — the agreement must be signed first." }
  if (account.status !== "active") return { error: "Account is not active" }

  const amountCents = Math.round(amount * 100)

  try {
    await stripe.invoiceItems.create({
      customer: account.stripe_customer_id,
      amount: amountCents,
      currency: "usd",
      description: notes || `Commercial laundry service${periodFrom && periodTo ? ` (${periodFrom} – ${periodTo})` : ""}`,
    })

    const invoice = await stripe.invoices.create({
      customer: account.stripe_customer_id,
      collection_method: "send_invoice",
      days_until_due: 15,
      auto_advance: true,
    })

    const finalized = await stripe.invoices.finalizeInvoice(invoice.id)
    await stripe.invoices.sendInvoice(invoice.id)

    await supabase.from("commercial_invoices").insert({
      location_id: account.location_id,
      commercial_account_id: accountId,
      amount_cents: amountCents,
      period_from: periodFrom,
      period_to: periodTo,
      notes,
      stripe_invoice_id: finalized.id,
      status: "sent",
    })

    revalidatePath("/admin/commercial")
    return { success: true }
  } catch (err) {
    console.error("[issueCommercialInvoice]", err)
    return { error: err instanceof Error ? err.message : "Failed to issue invoice via Stripe" }
  }
}
