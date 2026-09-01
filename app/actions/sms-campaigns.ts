"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId, getBranding } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"
import { sendSMS } from "@/lib/sms"
import { computeSegment, type Segment } from "@/lib/customer-segments"
import { revalidatePath } from "next/cache"

export interface SmsCampaign {
  id: string
  name: string
  message: string
  segment: string
  promo_code: string | null
  recipient_count: number
  sent_count: number
  failed_count: number
  status: string
  created_at: string
  sent_at: string | null
}

export async function getSmsCampaigns(): Promise<SmsCampaign[]> {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase
    .from("sms_campaigns")
    .select("*")
    .eq("location_id", locationId)
    .order("created_at", { ascending: false })
    .limit(50)
  return (data ?? []) as SmsCampaign[]
}

/** Preview how many customers a segment covers before actually sending. */
export async function getRecipientCount(segment: Segment | "all"): Promise<number> {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase
    .from("customers")
    .select("id, total_bookings, last_booking_at, phone, sms_opt_out")
    .eq("location_id", locationId)

  return (data ?? []).filter(c => c.phone && !c.sms_opt_out && (segment === "all" || computeSegment(c) === segment)).length
}

/**
 * Composes and immediately sends an SMS campaign to every opted-in customer
 * with a phone number in the given segment. Runs the sends with limited
 * concurrency (Twilio rate limits + this being a synchronous server action
 * called from an admin button, not a queue) and logs the result either way.
 */
export async function sendSmsCampaign(params: {
  name: string
  message: string
  segment: Segment | "all"
  promoCode?: string
}): Promise<{ error?: string; sent?: number; failed?: number }> {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, phone, total_bookings, last_booking_at, sms_opt_out")
    .eq("location_id", locationId)

  const recipients = (customers ?? []).filter(c =>
    c.phone && !c.sms_opt_out && (params.segment === "all" || computeSegment(c) === params.segment)
  )

  const { data: campaign } = await supabase
    .from("sms_campaigns")
    .insert({
      location_id: locationId,
      name: params.name,
      message: params.message,
      segment: params.segment,
      promo_code: params.promoCode || null,
      recipient_count: recipients.length,
      status: "sending",
    })
    .select("id")
    .single()

  if (!campaign) return { error: "Failed to create campaign record." }

  let sent = 0
  let failed = 0
  const BATCH = 10
  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH)
    const results = await Promise.all(
      batch.map(r => {
        const personalized = params.message
          .replace(/\{name\}/g, r.name?.split(" ")[0] ?? "there")
          .replace(/\{code\}/g, params.promoCode ?? "")
        return sendSMS(r.phone as string, personalized)
      })
    )
    for (const r of results) r.success ? sent++ : failed++
  }

  await supabase
    .from("sms_campaigns")
    .update({ sent_count: sent, failed_count: failed, status: "sent", sent_at: new Date().toISOString() })
    .eq("id", campaign.id)

  revalidatePath("/admin/marketing")
  return { sent, failed }
}
