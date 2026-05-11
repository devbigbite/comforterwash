"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { stripe } from "@/lib/stripe"
import { revalidatePath } from "next/cache"
import { getLocationId } from "@/lib/location"

// ── Submit application (public) ───────────────────────────────────────────────
export async function submitApplication(formData: FormData) {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]

  const roles: string[] = []
  if (formData.get("role_driver") === "on") roles.push("driver")
  if (formData.get("role_operator") === "on") roles.push("operator")

  const { error } = await supabase.from("workers").insert({
    location_id: locationId,
    name:        formData.get("name") as string,
    email:       formData.get("email") as string,
    phone:       formData.get("phone") as string,
    address:     formData.get("address") as string,
    roles,
    has_vehicle: formData.get("has_vehicle") === "on",
    experience:  formData.get("experience") as string,
    status:      "pending",
  })

  if (error) {
    if (error.code === "23505") return { error: "An application with that email already exists." }
    return { error: "Failed to submit application. Please try again." }
  }

  return { success: true }
}

// ── Approve worker ────────────────────────────────────────────────────────────
export async function approveWorker(workerId: string) {
  const supabase = createAdminClient()
  await supabase.from("workers").update({ status: "approved" }).eq("id", workerId)
  revalidatePath("/admin/workers")
}

// ── Reject worker ─────────────────────────────────────────────────────────────
export async function rejectWorker(workerId: string, notes?: string) {
  const supabase = createAdminClient()
  await supabase
    .from("workers")
    .update({ status: "rejected", admin_notes: notes ?? null })
    .eq("id", workerId)
  revalidatePath("/admin/workers")
}

// ── Update pay rates ──────────────────────────────────────────────────────────
export async function updatePayRates(formData: FormData) {
  const supabase = createAdminClient()
  const workerId = formData.get("workerId") as string

  await supabase.from("workers").update({
    driver_per_order_cents:   Math.round(parseFloat(formData.get("driver_per_order") as string || "0") * 100),
    driver_per_mile_cents:    Math.round(parseFloat(formData.get("driver_per_mile") as string || "0") * 100),
    operator_per_hour_cents:  Math.round(parseFloat(formData.get("operator_per_hour") as string || "0") * 100),
    operator_per_mile_cents:  Math.round(parseFloat(formData.get("operator_per_mile") as string || "0") * 100),
    hourly_wage_cents:        Math.round(parseFloat(formData.get("hourly_wage") as string || "0") * 100),
    status: "active",
  }).eq("id", workerId)

  revalidatePath("/admin/workers")
}

// ── Create Stripe Connect Express account + return onboarding URL ─────────────
export async function createStripeConnectAccount(workerId: string) {
  const supabase = createAdminClient()
  const { data: worker } = await supabase
    .from("workers")
    .select("id, name, email, stripe_account_id")
    .eq("id", workerId)
    .single()

  if (!worker) return { error: "Worker not found" }

  let accountId = worker.stripe_account_id

  // Create Express account if one doesn't exist yet
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: worker.email,
      capabilities: {
        transfers: { requested: true },
      },
      business_type: "individual",
      settings: {
        payouts: { schedule: { interval: "weekly", weekly_anchor: "friday" } },
      },
    })
    accountId = account.id

    await supabase
      .from("workers")
      .update({ stripe_account_id: accountId })
      .eq("id", workerId)
  }

  // Generate fresh onboarding link (valid for 24h)
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/admin/workers/${workerId}?refresh=1`,
    return_url:  `${origin}/admin/workers/${workerId}?onboarded=1`,
    type: "account_onboarding",
  })

  revalidatePath("/admin/workers")
  return { url: link.url }
}

// ── Sync onboarding status from Stripe ───────────────────────────────────────
export async function syncStripeStatus(workerId: string) {
  const supabase = createAdminClient()
  const { data: worker } = await supabase
    .from("workers")
    .select("stripe_account_id")
    .eq("id", workerId)
    .single()

  if (!worker?.stripe_account_id) return { error: "No Stripe account linked" }

  const account = await stripe.accounts.retrieve(worker.stripe_account_id)
  const complete = account.details_submitted && !account.requirements?.currently_due?.length

  await supabase
    .from("workers")
    .update({ stripe_onboarding_complete: complete })
    .eq("id", workerId)

  revalidatePath("/admin/workers")
  return { complete }
}

// ── Issue payout ──────────────────────────────────────────────────────────────
export async function issuePayout(formData: FormData) {
  const supabase = createAdminClient()
  const workerId  = formData.get("workerId") as string
  const bookingId = formData.get("bookingId") as string | null
  const type      = formData.get("type") as string          // delivery | operation | mileage | manual
  const miles     = parseFloat(formData.get("miles") as string || "0")
  const hours     = parseFloat(formData.get("hours") as string || "0")
  const manualCents = parseInt(formData.get("manualCents") as string || "0")
  const notes     = formData.get("notes") as string

  const { data: worker } = await supabase
    .from("workers")
    .select("stripe_account_id, stripe_onboarding_complete, driver_per_order_cents, driver_per_mile_cents, operator_per_hour_cents, operator_per_mile_cents")
    .eq("id", workerId)
    .single()

  if (!worker?.stripe_account_id) return { error: "No Stripe Connect account linked" }
  if (!worker.stripe_onboarding_complete) return { error: "Worker has not completed Stripe onboarding" }

  // Calculate amount
  let amountCents = manualCents
  if (type === "delivery") amountCents = (worker.driver_per_order_cents ?? 0) + Math.round(miles * (worker.driver_per_mile_cents ?? 0))
  if (type === "operation") amountCents = Math.round(hours * (worker.operator_per_hour_cents ?? 0)) + Math.round(miles * (worker.operator_per_mile_cents ?? 0))
  if (type === "mileage")  amountCents = Math.round(miles * (worker.driver_per_mile_cents ?? 0))

  if (amountCents <= 0) return { error: "Calculated payout is $0 — check pay rates or input values." }

  // Create Stripe transfer to connected account
  const transfer = await stripe.transfers.create({
    amount:      amountCents,
    currency:    "usd",
    destination: worker.stripe_account_id,
    description: `WashFold payout — ${type}${bookingId ? ` — booking ${bookingId.slice(0, 8).toUpperCase()}` : ""}`,
  })

  // Record payout
  await supabase.from("worker_payouts").insert({
    worker_id:         workerId,
    booking_id:        bookingId || null,
    payout_type:       type,
    amount_cents:      amountCents,
    miles:             miles || null,
    hours:             hours || null,
    stripe_transfer_id: transfer.id,
    status:            "transferred",
    notes:             notes || null,
  })

  revalidatePath("/admin/workers")
  revalidatePath(`/admin/workers/${workerId}`)
  return { success: true, amountCents }
}
