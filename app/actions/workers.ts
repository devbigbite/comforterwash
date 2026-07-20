"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { stripe } from "@/lib/stripe"
import { revalidatePath } from "next/cache"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"

// ── Worker detail bundle (admin) ──────────────────────────────────────────────
// Replaces direct anon-client reads on the worker detail page. workers /
// worker_payouts carry PII + financial data and must never be read with the
// anon key, so this is the only sanctioned way to fetch them.
export async function getWorkerDetail(workerId: string) {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]

  const [{ data: worker }, { data: payouts }, { data: documents }, { data: mileageReports }] = await Promise.all([
    supabase.from("workers").select("*").eq("id", workerId).eq("location_id", locationId).single(),
    supabase.from("worker_payouts").select("*").eq("worker_id", workerId).eq("location_id", locationId).order("created_at", { ascending: false }),
    supabase.from("worker_documents").select("*").eq("worker_id", workerId).eq("location_id", locationId).order("created_at", { ascending: false }),
    supabase.from("worker_mileage_reports").select("*").eq("worker_id", workerId).eq("location_id", locationId).order("report_date", { ascending: false }),
  ])

  return {
    worker: worker ?? null,
    payouts: payouts ?? [],
    documents: documents ?? [],
    mileageReports: mileageReports ?? [],
  }
}

// ── Submit application (public) ───────────────────────────────────────────────
export async function submitApplication(formData: FormData) {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]

  const roles: string[] = []
  if (formData.get("role_driver") === "on")            roles.push("driver")
  if (formData.get("role_washing_operator") === "on")   roles.push("operator")
  // combo role: "Washing Operator / Driver" adds both
  if (formData.get("role_combo") === "on") {
    if (!roles.includes("driver"))   roles.push("driver")
    if (!roles.includes("operator")) roles.push("operator")
  }

  const icSignature = formData.get("ic_signature") as string | null
  const icRole      = formData.get("ic_role") as string | null

  const isDriverPath = roles.includes("driver")

  // Optional extended driver questionnaire — only present when role includes driver
  const bool = (key: string) => {
    const v = formData.get(key)
    return v === null ? null : v === "yes"
  }
  const drivingExperience = formData.getAll("driving_experience") as string[]
  const preferredAvailability = formData.getAll("preferred_availability") as string[]
  const availabilityRaw = formData.get("availability_json") as string | null
  let availability: unknown = null
  if (availabilityRaw) {
    try { availability = JSON.parse(availabilityRaw) } catch { availability = null }
  }

  const { error } = await supabase.from("workers").insert({
    location_id:              locationId,
    name:                     formData.get("name") as string,
    email:                    formData.get("email") as string,
    phone:                    formData.get("phone") as string,
    address:                  formData.get("address") as string,
    roles,
    has_vehicle:              isDriverPath ? Boolean(formData.get("vehicle_brand")) : formData.get("has_vehicle") === "on",
    experience:               formData.get("experience") as string,
    status:                   "pending",
    ic_agreement_signature:   icSignature || null,
    ic_agreement_signed_at:   icSignature ? new Date().toISOString() : null,
    ic_agreement_role:        icRole || null,

    ...(isDriverPath ? {
      age_18_plus:                  bool("age_18_plus"),
      had_prior_jobs:                bool("had_prior_jobs"),
      driving_experience:            drivingExperience.length ? drivingExperience : null,
      driving_experience_details:    (formData.get("driving_experience_details") as string) || null,
      can_lift_50lbs:                bool("can_lift_50lbs"),
      committed_to_training:         bool("committed_to_training"),
      seeking_long_term:             bool("seeking_long_term"),
      background_check_consent:      bool("background_check_consent"),
      vehicle_brand:                 (formData.get("vehicle_brand") as string) || null,
      vehicle_model:                 (formData.get("vehicle_model") as string) || null,
      vehicle_year:                  (formData.get("vehicle_year") as string) || null,
      vehicle_color:                 (formData.get("vehicle_color") as string) || null,
      vehicle_photo_url:             (formData.get("vehicle_photo_url") as string) || null,
      vehicle_registration_valid:    bool("vehicle_registration_valid"),
      vehicle_insurance_valid:       bool("vehicle_insurance_valid"),
      vehicle_insurance_commercial_ok: (formData.get("vehicle_insurance_commercial_ok") as string) || null,
      availability,
      preferred_availability:        preferredAvailability.length ? preferredAvailability : null,
      schedule_conflicts_ok:         bool("schedule_conflicts_ok"),
      schedule_conflicts_notes:      (formData.get("schedule_conflicts_notes") as string) || null,
      training_availability_date:    (formData.get("training_availability_date") as string) || null,
      why_hire_you:                  (formData.get("why_hire_you") as string) || null,
      resume_url:                    (formData.get("resume_url") as string) || null,
      selfie_url:                    (formData.get("selfie_url") as string) || null,
    } : {}),
  })

  if (error) {
    if (error.code === "23505") return { error: "An application with that email already exists." }
    return { error: "Failed to submit application. Please try again." }
  }

  return { success: true }
}

// ── Approve worker ────────────────────────────────────────────────────────────
export async function approveWorker(workerId: string) {
  await requireAdmin()

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("workers").update({ status: "approved" }).eq("id", workerId).eq("location_id", locationId)
  revalidatePath("/admin/workers")
}

// ── Reject worker ─────────────────────────────────────────────────────────────
export async function rejectWorker(workerId: string, notes?: string) {
  await requireAdmin()

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase
    .from("workers")
    .update({ status: "rejected", admin_notes: notes ?? null })
    .eq("id", workerId)
    .eq("location_id", locationId)
  revalidatePath("/admin/workers")
}

// ── Update pay rates ──────────────────────────────────────────────────────────
export async function updatePayRates(formData: FormData) {
  await requireAdmin()

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const workerId = formData.get("workerId") as string

  await supabase.from("workers").update({
    driver_per_order_cents:   Math.round(parseFloat(formData.get("driver_per_order") as string || "0") * 100),
    driver_per_mile_cents:    Math.round(parseFloat(formData.get("driver_per_mile") as string || "0") * 100),
    operator_per_hour_cents:  Math.round(parseFloat(formData.get("operator_per_hour") as string || "0") * 100),
    operator_per_mile_cents:  Math.round(parseFloat(formData.get("operator_per_mile") as string || "0") * 100),
    hourly_wage_cents:        Math.round(parseFloat(formData.get("hourly_wage") as string || "0") * 100),
    status: "active",
  }).eq("id", workerId).eq("location_id", locationId)

  revalidatePath("/admin/workers")
}

// ── Create Stripe Connect Express account + return onboarding URL ─────────────
export async function createStripeConnectAccount(workerId: string) {
  await requireAdmin()

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data: worker } = await supabase
    .from("workers")
    .select("id, name, email, stripe_account_id")
    .eq("id", workerId)
    .eq("location_id", locationId)
    .single()

  if (!worker) return { error: "Worker not found" }

  let accountId = worker.stripe_account_id

  // Create Express account if one doesn't exist yet
  if (!accountId) {
    const account = await stripe.accounts.create({
      controller: {
        stripe_dashboard: { type: "express" },
        fees:             { payer: "application" },
        losses:           { payments: "application" },
      },
      email:         worker.email,
      capabilities: { transfers: { requested: true } },
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
  await requireAdmin()

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data: worker } = await supabase
    .from("workers")
    .select("stripe_account_id")
    .eq("id", workerId)
    .eq("location_id", locationId)
    .single()

  if (!worker?.stripe_account_id) return { error: "No Stripe account linked" }

  const account = await stripe.accounts.retrieve(worker.stripe_account_id)
  const complete = account.details_submitted && !account.requirements?.currently_due?.length

  await supabase
    .from("workers")
    .update({ stripe_onboarding_complete: complete })
    .eq("id", workerId)
    .eq("location_id", locationId)

  revalidatePath("/admin/workers")
  return { complete }
}

// ── Issue payout ──────────────────────────────────────────────────────────────
export async function issuePayout(formData: FormData) {
  await requireAdmin()

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
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
    .eq("location_id", locationId)
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
    location_id:       locationId,
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

// ── Worker Documents ──────────────────────────────────────────────────────────
export async function addWorkerDocument(formData: FormData) {
  await requireAdmin()
  const supabase = createAdminClient()
  const locationId = await getLocationId()

  const { error } = await supabase.from("worker_documents").insert({
    worker_id:     formData.get("worker_id") as string,
    location_id:   locationId,
    document_type: formData.get("document_type") as string,
    file_name:     formData.get("file_name") as string,
    external_url:  (formData.get("external_url") as string) || null,
    notes:         (formData.get("notes") as string) || null,
  })

  if (error) return { error: error.message }
  revalidatePath(`/admin/workers/${formData.get("worker_id")}`)
  return { success: true }
}

export async function deleteWorkerDocument(documentId: string, workerId: string) {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("worker_documents").delete().eq("id", documentId).eq("location_id", locationId)
  revalidatePath(`/admin/workers/${workerId}`)
}


// ── Create worker manually (admin) ───────────────────────────────────────────
export async function createWorkerManually(formData: FormData) {
  await requireAdmin()

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]

  const roles: string[] = []
  if (formData.get("role_driver") === "on")    roles.push("driver")
  if (formData.get("role_operator") === "on")  roles.push("operator")

  const { error } = await supabase.from("workers").insert({
    location_id:  locationId,
    name:         formData.get("name") as string,
    email:        formData.get("email") as string,
    phone:        (formData.get("phone") as string) || null,
    address:      (formData.get("address") as string) || null,
    roles,
    has_vehicle:    formData.get("has_vehicle") === "on",
    experience:     (formData.get("experience") as string) || null,
    shipday_email:  (formData.get("shipday_email") as string) || null,
    status:       "approved",
  })

  if (error) {
    if (error.code === "23505") return { error: "A worker with that email already exists." }
    return { error: error.message }
  }

  revalidatePath("/admin/workers")
  return { success: true }
}

// ── Worker Mileage Reports ────────────────────────────────────────────────────
export async function addMileageReport(formData: FormData) {
  await requireAdmin()
  const supabase = createAdminClient()
  const locationId = await getLocationId()

  const { error } = await supabase.from("worker_mileage_reports").insert({
    worker_id:   formData.get("worker_id") as string,
    location_id: locationId,
    report_date: formData.get("report_date") as string,
    description: formData.get("description") as string,
    miles:       parseFloat(formData.get("miles") as string || "0"),
    notes:       (formData.get("notes") as string) || null,
  })

  if (error) return { error: error.message }
  revalidatePath(`/admin/workers/${formData.get("worker_id") as string}`)
  return { success: true }
}

export async function deleteMileageReport(reportId: string, workerId: string) {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("worker_mileage_reports").delete().eq("id", reportId).eq("location_id", locationId)
  revalidatePath(`/admin/workers/${workerId}`)
}

// ── Update worker roles ───────────────────────────────────────────────────────
export async function updateWorkerRoles(formData: FormData) {
  await requireAdmin()

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const workerId = formData.get("workerId") as string

  const roles: string[] = []
  if (formData.get("role_driver") === "on")   roles.push("driver")
  if (formData.get("role_operator") === "on") roles.push("operator")

  await supabase.from("workers").update({ roles }).eq("id", workerId).eq("location_id", locationId)

  revalidatePath(`/admin/workers/${workerId}`)
  revalidatePath("/admin/workers")
  return { success: true }
}
