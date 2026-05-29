import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import { revalidatePath } from "next/cache"
import { PartnerPortalClient } from "@/components/partner/PartnerPortalClient"
import { createFacilityStripeAccount, syncFacilityStripeStatus, getFacilityPayouts } from "@/app/actions/facility-payments"

const OPERATOR_ZONE = ["at_facility", "in_washer", "in_dryer", "folded"]
const AT_FACILITY_STATUSES = ["at_facility", "in_washer", "in_dryer", "folded", "ready"]

async function partnerCompleteOrder(formData: FormData) {
  "use server"
  const bookingId    = formData.get("bookingId") as string
  const facilityCode = formData.get("facilityCode") as string
  const bagCount     = (formData.get("bag_count") as string) || null
  const notes        = (formData.get("notes") as string)?.trim() || null
  const supabase     = createAdminClient()

  const { data: bags } = await supabase
    .from("order_bags")
    .select("id, status")
    .eq("booking_id", bookingId)
    .in("status", OPERATOR_ZONE)

  if (!bags?.length) return

  await supabase
    .from("order_bags")
    .update({ status: "ready" })
    .eq("booking_id", bookingId)
    .in("status", OPERATOR_ZONE)

  const noteParts = [
    `Partner confirmed ${bagCount ?? bags.length} bag${parseInt(bagCount ?? String(bags.length)) !== 1 ? "s" : ""} ready`,
    notes ? `Notes: ${notes}` : null,
  ].filter(Boolean).join(" · ")

  await supabase.from("order_events").insert({
    booking_id:  bookingId,
    event_type:  "partner_completion",
    notes:       noteParts,
    created_by:  "partner_attendant",
  })

  revalidatePath(`/partner/${facilityCode}`)
}

async function recordPartnerPhoto(formData: FormData) {
  "use server"
  const bookingId = formData.get("bookingId") as string
  const photoUrl  = formData.get("photoUrl") as string
  const supabase  = createAdminClient()
  await supabase.from("order_events").insert({
    booking_id:  bookingId,
    event_type:  "partner_photo",
    notes:       photoUrl,
    created_by:  "partner_attendant",
  })
}

async function connectStripe(formData: FormData) {
  "use server"
  const facilityId   = formData.get("facilityId") as string
  const facilityCode = formData.get("facilityCode") as string
  const result = await createFacilityStripeAccount(facilityId, facilityCode)
  if (result.url) {
    const { redirect } = await import("next/navigation")
    redirect(result.url)
  }
}

async function syncStripe(formData: FormData) {
  "use server"
  const facilityId   = formData.get("facilityId") as string
  const facilityCode = formData.get("facilityCode") as string
  await syncFacilityStripeStatus(facilityId)
  const { redirect } = await import("next/navigation")
  redirect(`/partner/${facilityCode}`)
}

export default async function PartnerPortalPage({ params, searchParams }: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ stripe_return?: string; stripe_refresh?: string }>
}) {
  const { code } = await params
  const sp = await searchParams
  const supabase  = createAdminClient()

  const { data: facility } = await supabase
    .from("facilities")
    .select("id, name, address, phone, manager, owner, rate_per_lb, minimum_lbs, supports_partner_attendant, supports_own_operator, partner_access_code, stripe_account_id, stripe_onboarding_complete, contact_email")
    .eq("partner_access_code", code)
    .eq("active", true)
    .single()

  if (!facility) notFound()

  // Auto-sync Stripe status on return from onboarding
  if ((sp.stripe_return || sp.stripe_refresh) && facility.stripe_account_id) {
    await syncFacilityStripeStatus(facility.id)
    // Re-fetch after sync
    const { data: refreshed } = await supabase
      .from("facilities")
      .select("stripe_onboarding_complete")
      .eq("id", facility.id)
      .single()
    if (refreshed) facility.stripe_onboarding_complete = refreshed.stripe_onboarding_complete
  }

  const [{ data: activeBookings }, { data: historyBookings }, payouts] = await Promise.all([
    supabase
      .from("bookings")
      .select(`id, service_type, delivery_date, actual_weight_lbs, facility_processing_mode,
               order_bags(id, status, bag_number, label_code)`)
      .eq("assigned_facility_id", facility.id)
      .in("status", AT_FACILITY_STATUSES)
      .order("delivery_date", { ascending: true }),

    supabase
      .from("bookings")
      .select("id, short_code, service_type, delivery_date, actual_weight_lbs, facility_cost_cents, status, created_at")
      .eq("assigned_facility_id", facility.id)
      .in("status", ["ready_at_warehouse", "out_for_delivery", "delivered"])
      .not("actual_weight_lbs", "is", null)
      .order("delivery_date", { ascending: false }),

    getFacilityPayouts(facility.id),
  ])

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })

  return (
    <PartnerPortalClient
      facility={facility}
      activeBookings={activeBookings ?? []}
      historyBookings={historyBookings ?? []}
      payouts={payouts}
      today={today}
      facilityCode={code}
      partnerCompleteOrderAction={partnerCompleteOrder}
      recordPartnerPhotoAction={recordPartnerPhoto}
      connectStripeAction={connectStripe}
      syncStripeAction={syncStripe}
    />
  )
}
