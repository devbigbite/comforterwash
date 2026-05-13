"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { revalidatePath } from "next/cache"

// ── Phase definitions ─────────────────────────────────────────────────────────

export const PHASES = [
  { key: "at_storage",           label: "At Storage",        icon: "📦", color: "#64748b" },
  { key: "in_transit",           label: "In Transit",        icon: "🚐", color: "#f59e0b" },
  { key: "intake",               label: "Intake",            icon: "📥", color: "#8b5cf6" },
  { key: "washing",              label: "Washing",           icon: "🫧", color: "#3b82f6" },
  { key: "drying",               label: "Drying",            icon: "💨", color: "#06b6d4" },
  { key: "folding",              label: "Folding",           icon: "👕", color: "#10b981" },
  { key: "ready",                label: "Ready",             icon: "✅", color: "#22c55e" },
  { key: "out_for_delivery",     label: "Out for Delivery",  icon: "🚗", color: "#f97316" },
] as const

export type Phase = typeof PHASES[number]["key"]

// ── Booking shape for the board ───────────────────────────────────────────────

export interface BoardOrder {
  id: string
  short_code: string | null
  customer_name: string
  service_type: string
  num_bags: number
  phase: string
  phase_updated_at: string | null
  assigned_facility_id: string | null
  actual_weight_lbs: number | null
  status: string
  pickup_date: string
  created_at: string
}

// ── Get all orders for the facility board ─────────────────────────────────────

export async function getFacilityBoardOrders(facilityId?: string): Promise<Record<string, BoardOrder[]>> {
  const supabase = createAdminClient()
  const locationId = await getLocationId()

  let query = supabase
    .from("bookings")
    .select("id, short_code, customer_name, service_type, num_bags, phase, phase_updated_at, assigned_facility_id, actual_weight_lbs, status, pickup_date, created_at")
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

  revalidatePath("/facility")
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
