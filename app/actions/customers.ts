"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"
import { computeSegment, type Segment } from "@/lib/customer-segments"
import { revalidatePath } from "next/cache"

export interface Customer {
  id: string
  location_id: string
  email: string | null
  phone: string | null
  name: string | null
  first_booking_at: string | null
  last_booking_at: string | null
  total_bookings: number
  total_spent_cents: number
  referral_code: string | null
  referred_by_customer_id: string | null
  sms_opt_out: boolean
  last_reengagement_sent_at: string | null
  created_at: string
}

/**
 * Upserts a customer row from a just-created booking — called from
 * createBooking (app/actions/bookings.ts) right after a successful insert.
 * Never throws; a sync failure shouldn't block the booking itself.
 */
export async function syncCustomerFromBooking(params: {
  locationId: string
  email: string
  phone: string
  name: string
  amountCents: number
  bookingCreatedAt: string
  referredByCode?: string | null
}): Promise<{ customerId: string | null }> {
  try {
    if (!params.email) return { customerId: null }
    const supabase = createAdminClient()

    const { data: existing } = await supabase
      .from("customers")
      .select("id, total_bookings, total_spent_cents, first_booking_at")
      .eq("location_id", params.locationId)
      .eq("email", params.email)
      .maybeSingle()

    let referredByCustomerId: string | null = null
    if (params.referredByCode) {
      const { data: referrer } = await supabase
        .from("customers")
        .select("id, email")
        .eq("location_id", params.locationId)
        .eq("referral_code", params.referredByCode.toUpperCase().trim())
        .maybeSingle()
      if (referrer && referrer.email !== params.email) referredByCustomerId = referrer.id
    }

    if (existing) {
      const { data: updated } = await supabase
        .from("customers")
        .update({
          phone: params.phone || undefined,
          name: params.name || undefined,
          last_booking_at: params.bookingCreatedAt,
          total_bookings: existing.total_bookings + 1,
          total_spent_cents: existing.total_spent_cents + params.amountCents,
          updated_at: new Date().toISOString(),
          ...(referredByCustomerId ? { referred_by_customer_id: referredByCustomerId } : {}),
        })
        .eq("id", existing.id)
        .select("id")
        .single()
      return { customerId: updated?.id ?? existing.id }
    }

    const { data: created } = await supabase
      .from("customers")
      .insert({
        location_id: params.locationId,
        email: params.email,
        phone: params.phone || null,
        name: params.name || null,
        first_booking_at: params.bookingCreatedAt,
        last_booking_at: params.bookingCreatedAt,
        total_bookings: 1,
        total_spent_cents: params.amountCents,
        referred_by_customer_id: referredByCustomerId,
      })
      .select("id")
      .single()
    return { customerId: created?.id ?? null }
  } catch (err) {
    console.error("[customers] syncCustomerFromBooking failed:", err)
    return { customerId: null }
  }
}

export async function getCustomersWithSegments(): Promise<(Customer & { segment: Segment })[]> {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("location_id", locationId)
    .order("last_booking_at", { ascending: false, nullsFirst: false })

  return (data ?? []).map(c => ({ ...c, segment: computeSegment(c) })) as (Customer & { segment: Segment })[]
}

export async function getSegmentCounts(): Promise<Record<Segment, number>> {
  const customers = await getCustomersWithSegments()
  const counts: Record<Segment, number> = { new: 0, active: 0, at_risk: 0, dormant: 0 }
  for (const c of customers) counts[c.segment]++
  return counts
}

/** Generates a short, human-typeable referral code, e.g. "SARAH482". */
function makeReferralCode(name: string | null): string {
  const base = (name ?? "FRIEND").split(" ")[0].toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8) || "FRIEND"
  const suffix = Math.floor(100 + Math.random() * 900)
  return `${base}${suffix}`
}

/** Returns a customer's referral code, generating + persisting one on first request. */
export async function getOrCreateReferralCode(customerId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data: customer } = await supabase.from("customers").select("id, name, referral_code").eq("id", customerId).maybeSingle()
  if (!customer) return null
  if (customer.referral_code) return customer.referral_code

  // Retry a few times in case of a rare collision (unique constraint on referral_code)
  for (let i = 0; i < 5; i++) {
    const code = makeReferralCode(customer.name)
    const { error } = await supabase.from("customers").update({ referral_code: code }).eq("id", customerId)
    if (!error) return code
  }
  return null
}

/** Looks up (or creates, if this is their first-ever contact) a customer's referral code by email — used by the admin Customers page. */
export async function getReferralCodeByEmail(email: string): Promise<string | null> {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("location_id", locationId)
    .eq("email", email)
    .maybeSingle()
  if (!customer) return null
  return getOrCreateReferralCode(customer.id)
}

export async function toggleCustomerSmsOptOut(customerId: string, optOut: boolean): Promise<void> {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("customers").update({ sms_opt_out: optOut }).eq("id", customerId).eq("location_id", locationId)
  revalidatePath("/admin/customers")
}
