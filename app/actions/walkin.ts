"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"

// ── Walk-in / drop-off orders ─────────────────────────────────────────────────
// For home-based operators whose customers bring bags in person instead of
// scheduling a pickup/delivery. These orders:
//   - skip pickup_date/time_window entirely (bags are already in hand)
//   - start at status "picked_up" / phase "intake" (we already have the bags)
//   - never touch Shipday — no driver dispatch, no pickup/delivery orders
//   - are completed by marking "delivered" once the customer picks the clean
//     order back up in person (label reused; UI shows "Picked Up" for these)

export interface WalkinOrderData {
  customerName: string
  customerPhone: string
  customerEmail?: string
  serviceType: "comforter_wash" | "wash_fold" | "wash_only"
  numBags?: number
  numComforters?: number
  pounds?: number
  comforterSize?: string
  detergent?: string
  extras?: string
  totalAmount: number
  notes?: string
}

function generateShortCode(): string {
  return String(Math.floor(Math.random() * 900000) + 100000)
}

const COLOR_ROTATION = [
  "red", "blue", "sky", "green", "lime",
  "pink", "hotpink", "orange", "purple",
]

async function pickColorKey(supabase: ReturnType<typeof createAdminClient>, today: string) {
  const { data } = await supabase
    .from("bookings")
    .select("color_key")
    .eq("pickup_date", today)
    .not("color_key", "is", null)
  const taken = new Set((data ?? []).map((b: { color_key: string | null }) => b.color_key).filter(Boolean))
  return COLOR_ROTATION.find(c => !taken.has(c)) ?? COLOR_ROTATION[taken.size % COLOR_ROTATION.length]
}

export async function createWalkinOrder(data: WalkinOrderData): Promise<{ id: string; short_code: string | null }> {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]

  const today = new Date().toISOString().split("T")[0]
  const colorKey = await pickColorKey(supabase, today)
  const numBags = data.numBags ?? data.numComforters ?? 1

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      location_id: locationId,
      short_code: generateShortCode(),
      customer_name: data.customerName,
      customer_phone: data.customerPhone,
      customer_email: data.customerEmail ?? "",
      customer_address: "Walk-in / drop-off",
      pickup_date: today,
      pickup_time_window: "Walk-in",
      delivery_date: today,
      delivery_time_window: "Walk-in",
      service_type: data.serviceType,
      num_bags: numBags,
      num_comforters: data.numComforters ?? 0,
      pounds: data.pounds ?? null,
      comforter_size: data.comforterSize ?? null,
      detergent: data.detergent ?? null,
      extras: data.extras ?? null,
      total_amount: data.totalAmount,
      payment_status: "paid",
      status: "picked_up",
      phase: "intake",
      fulfillment_type: "walkin",
      color_key: colorKey,
      notes: data.notes ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error("[walkin] insert failed:", error.message)
    throw new Error("Failed to create walk-in order")
  }

  try {
    const orderCode = booking.short_code ?? booking.id.slice(0, 6).toUpperCase()
    const bags = Array.from({ length: numBags }, (_, i) => ({
      booking_id: booking.id,
      bag_number: i + 1,
      label_code: `${orderCode}-B${i + 1}`,
      status: "pending",
    }))
    await supabase.from("order_bags").insert(bags)

    await supabase.from("order_events").insert({
      booking_id: booking.id,
      event_type: "booking_created",
      notes: `Walk-in drop-off. ${numBags} bag${numBags > 1 ? "s" : ""} received in person.`,
      created_by: "admin",
    })
  } catch (bagErr) {
    console.error("[walkin] Error creating order bags:", bagErr)
  }

  revalidatePath("/admin/walkin")
  return { id: booking.id, short_code: booking.short_code }
}

export async function getRecentWalkinOrders(limit = 20) {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase
    .from("bookings")
    .select("id, short_code, customer_name, customer_phone, service_type, num_bags, status, phase, total_amount, created_at")
    .eq("location_id", locationId)
    .eq("fulfillment_type", "walkin")
    .order("created_at", { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function markWalkinPickedUp(bookingId: string): Promise<void> {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase
    .from("bookings")
    .update({ status: "delivered", phase: "out_for_delivery" })
    .eq("id", bookingId)
    .eq("location_id", locationId)
    .eq("fulfillment_type", "walkin")
  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: "delivered",
    notes: "Customer picked up order in person.",
    created_by: "admin",
  })
  revalidatePath("/admin/walkin")
}

// ── Per-location fulfillment mode ─────────────────────────────────────────────
// Controls whether the walk-in quick-booking page is offered at all — a
// location that only does pickup/delivery shouldn't see it cluttering nav.

export type FulfillmentMode = "delivery" | "walkin" | "both"

export async function getFulfillmentMode(): Promise<FulfillmentMode> {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase.from("locations").select("fulfillment_mode").eq("id", locationId).single()
  return (data?.fulfillment_mode as FulfillmentMode) ?? "delivery"
}

export async function setFulfillmentMode(mode: FulfillmentMode): Promise<void> {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("locations").update({ fulfillment_mode: mode }).eq("id", locationId)
  revalidatePath("/admin")
  revalidatePath("/admin/branding")
}
