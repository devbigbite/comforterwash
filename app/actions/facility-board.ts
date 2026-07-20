"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"
import { PHASES } from "@/lib/facility-phases"

// ── Booking shape for the board ───────────────────────────────────────────────

export interface BoardOrder {
  id: string
  short_code: string | null
  customer_name: string
  service_type: string
  num_bags: number
  folded_bag_count: number | null
  phase: string
  phase_updated_at: string | null
  assigned_facility_id: string | null
  actual_weight_lbs: number | null
  status: string
  pickup_date: string
  delivery_date: string
  created_at: string
  hold_at_facility: boolean
  color_key: string | null
  facility_floor_photo_url: string | null
}

// ── Get all orders for the facility board ─────────────────────────────────────

export async function getFacilityBoardOrders(facilityId?: string): Promise<Record<string, BoardOrder[]>> {
  const supabase = createAdminClient()
  const locationId = await getLocationId()

  let query = supabase
    .from("bookings")
    .select("id, short_code, customer_name, service_type, num_bags, folded_bag_count, phase, phase_updated_at, assigned_facility_id, actual_weight_lbs, status, pickup_date, delivery_date, created_at, hold_at_facility, color_key, facility_floor_photo_url")
    .eq("location_id", locationId)
    .not("phase", "in", '("booked","delivered","cancelled")')
    .order("phase_updated_at", { ascending: true })

  if (facilityId) {
    query = query.eq("assigned_facility_id", facilityId)
  }

  const { data } = await query
  const orders = (data ?? []) as BoardOrder[]

  // Group by phase
  const grouped: Record<string, BoardOrder[]> = {}
  for (const p of PHASES) {
    grouped[p.key] = []
  }
  for (const order of orders) {
    const phase = order.phase ?? "at_storage"
    if (grouped[phase]) {
      grouped[phase].push(order)
    }
  }
  return grouped
}

// ── Move an order to a new phase (facility board drag-and-drop) ───────────────

export async function moveOrderPhase(
  bookingId: string,
  toPhase: string,
  workerId: string | null,
  workerName: string | null
): Promise<{ error?: string }> {
  await requireAdmin()
  const supabase = createAdminClient()
  const locationId = await getLocationId()

  // Get current phase
  const { data: booking } = await supabase
    .from("bookings")
    .select("phase")
    .eq("id", bookingId)
    .single()

  const fromPhase = booking?.phase ?? null

  // Update phase on booking
  const { error } = await supabase
    .from("bookings")
    .update({
      phase: toPhase,
      phase_updated_at: new Date().toISOString(),
      phase_updated_by: workerId ?? null,
    })
    .eq("id", bookingId)
    .eq("location_id", locationId)

  if (error) return { error: error.message }

  // Log the transition
  await supabase.from("phase_transitions").insert({
    booking_id:  bookingId,
    location_id: locationId,
    from_phase:  fromPhase,
    to_phase:    toPhase,
    worker_id:   workerId ?? null,
    worker_name: workerName ?? null,
    source:      "facility_board",
  })

  // Also log to order_events for the order detail timeline
  await supabase.from("order_events").insert({
    booking_id:  bookingId,
    event_type:  "phase_changed",
    notes:       `Moved ${fromPhase ?? "?"} → ${toPhase}`,
    created_by:  workerName ?? "facility board",
  })

  revalidatePath("/admin/facility")
  revalidatePath(`/admin/orders/${bookingId}`)
  return {}
}

// ── Get phase transition history for an order ─────────────────────────────────

export interface PhaseTransition {
  id: string
  from_phase: string | null
  to_phase: string
  worker_name: string | null
  source: string
  created_at: string
}

export async function getPhaseHistory(bookingId: string): Promise<PhaseTransition[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("phase_transitions")
    .select("id, from_phase, to_phase, worker_name, source, created_at")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true })
  return (data ?? []) as PhaseTransition[]
}

// ── Get facilities list for board selector ────────────────────────────────────

export interface FacilitySummary {
  id: string
  name: string
  address: string | null
}

// ── Update facility floor details (hold, color key, photo, folded bag count) ──

export async function updateFacilityDetails(
  bookingId: string,
  updates: {
    hold_at_facility?: boolean
    color_key?: string | null
    facility_floor_photo_url?: string | null
    folded_bag_count?: number | null
  }
): Promise<{ error?: string }> {
  await requireAdmin()
  const supabase = createAdminClient()
  const locationId = await getLocationId()

  const { error } = await supabase
    .from("bookings")
    .update(updates)
    .eq("id", bookingId)
    .eq("location_id", locationId)

  if (error) return { error: error.message }

  revalidatePath("/admin/facility")
  revalidatePath(`/admin/orders/${bookingId}`)
  return {}
}

// ── Get signed upload URL for floor photo (Supabase Storage) ─────────────────

export async function getFloorPhotoUploadUrl(bookingId: string): Promise<{ url?: string; path?: string; error?: string }> {
  const supabase = createAdminClient()
  const path = `floor-photos/${bookingId}-${Date.now()}.jpg`

  const { data, error } = await supabase.storage
    .from("worker-docs")
    .createSignedUploadUrl(path)

  if (error) return { error: error.message }
  return { url: data.signedUrl, path }
}

export async function getActiveFacilities(): Promise<FacilitySummary[]> {
  const supabase = createAdminClient()
  const locationId = await getLocationId()
  const { data } = await supabase
    .from("facilities")
    .select("id, name, address")
    .eq("location_id", locationId)
    .eq("active", true)
    .order("name")
  return (data ?? []) as FacilitySummary[]
}
