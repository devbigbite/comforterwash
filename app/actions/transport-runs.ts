"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export interface TransportRun {
  id: string
  run_type: "to_facility" | "to_warehouse"
  facility_id: string | null
  facility_name: string | null
  assigned_to: string
  assigned_role: "driver" | "operator"
  order_ids: string[]
  status: "pending" | "completed" | "cancelled"
  notes: string | null
  photo_url: string | null
  created_at: string
  completed_at: string | null
  completed_by: string | null
}

export interface RunOrder {
  id: string
  short_code: string | null
  customer_name: string
  customer_address: string
  num_bags: number | null
  service_type: string
  status: string
}

// ── Create a transport run (admin) ────────────────────────────────────────────
export async function createTransportRun(formData: FormData) {
  const supabase = createAdminClient()

  const runType     = formData.get("runType")    as "to_facility" | "to_warehouse"
  const facilityId  = formData.get("facilityId") as string
  const assignedTo  = formData.get("assignedTo") as string
  const assignedRole= formData.get("assignedRole") as "driver" | "operator"
  const notes       = (formData.get("notes") as string) || null
  const orderIdsRaw = formData.get("orderIds")   as string  // comma-separated UUIDs

  const orderIds = orderIdsRaw
    ? orderIdsRaw.split(",").map(s => s.trim()).filter(Boolean)
    : []

  if (!runType || !facilityId || !assignedTo || !assignedRole || orderIds.length === 0) {
    return { error: "Missing required fields" }
  }

  // Get facility name for denormalisation
  const { data: facility } = await supabase
    .from("facilities")
    .select("name")
    .eq("id", facilityId)
    .single()

  const { data: run, error } = await supabase
    .from("transport_runs")
    .insert({
      run_type:      runType,
      facility_id:   facilityId,
      facility_name: facility?.name ?? null,
      assigned_to:   assignedTo,
      assigned_role: assignedRole,
      order_ids:     orderIds,
      notes,
      status: "pending",
    })
    .select()
    .single()

  if (error) {
    console.error("[transport-runs] create error:", error)
    return { error: "Failed to create run" }
  }

  revalidatePath("/admin/runs")
  return { run }
}

// ── Cancel a run (admin) ──────────────────────────────────────────────────────
export async function cancelTransportRun(runId: string) {
  const supabase = createAdminClient()
  await supabase
    .from("transport_runs")
    .update({ status: "cancelled" })
    .eq("id", runId)
  revalidatePath("/admin/runs")
}

// ── Execute a transport run (driver or operator) ──────────────────────────────
// Advances ALL orders in the run to the next status and assigns facility where needed.
export async function completeTransportRun(formData: FormData) {
  const supabase    = createAdminClient()
  const runId       = formData.get("runId")      as string
  const completedBy = formData.get("workerName") as string
  const photoUrl    = (formData.get("photoUrl")  as string) || null

  // Load the run
  const { data: run, error: runErr } = await supabase
    .from("transport_runs")
    .select("*")
    .eq("id", runId)
    .single()

  if (runErr || !run) return { error: "Run not found" }
  if (run.status !== "pending") return { error: "Run already completed or cancelled" }

  const orderIds: string[] = run.order_ids ?? []
  if (orderIds.length === 0) return { error: "No orders in run" }

  const now = new Date().toISOString()

  if (run.run_type === "to_facility") {
    // ── Warehouse → Facility ───────────────────────────────────────
    // Orders: at_warehouse → at_facility
    // Also sets assigned_facility_id and calculates facility cost

    // Get facility config for cost calc
    const { data: facility } = await supabase
      .from("facilities")
      .select("rate_per_lb, minimum_lbs, supports_own_operator")
      .eq("id", run.facility_id)
      .single()

    const facilityProcessingMode = facility?.supports_own_operator === false
      ? "partner_attendant"
      : "own_operator"

    // Update bags
    await supabase
      .from("order_bags")
      .update({ status: "at_facility" })
      .in("booking_id", orderIds)
      .eq("status", "at_warehouse")

    // Update each booking (need per-booking facility cost calc)
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, actual_weight_lbs, customer_final_cents")
      .in("id", orderIds)

    for (const bk of bookings ?? []) {
      let facilityCostCents: number | null = null
      if (facility?.rate_per_lb && bk.actual_weight_lbs) {
        const facilityLbs = Math.max(bk.actual_weight_lbs, facility.minimum_lbs ?? 0)
        facilityCostCents = Math.round(facilityLbs * facility.rate_per_lb * 100)
      }

      await supabase
        .from("bookings")
        .update({
          status:                    "at_facility",
          assigned_facility_id:      run.facility_id,
          facility_processing_mode:  facilityProcessingMode,
          facility_cost_cents:       facilityCostCents,
        })
        .eq("id", bk.id)
    }

    // Log event on each order
    const events = orderIds.map(bookingId => ({
      booking_id:  bookingId,
      event_type:  "transported_to_facility",
      notes:       `Transport run #${run.id.slice(0,8).toUpperCase()} · ${run.facility_name ?? run.facility_id} · by ${completedBy}`,
      photo_url:   photoUrl,
      created_by:  completedBy,
    }))
    await supabase.from("order_events").insert(events)

  } else {
    // ── Facility → Warehouse ───────────────────────────────────────
    // Orders: ready → ready_at_warehouse

    await supabase
      .from("order_bags")
      .update({ status: "ready_at_warehouse" })
      .in("booking_id", orderIds)
      .eq("status", "ready")

    await supabase
      .from("bookings")
      .update({ status: "ready_at_warehouse" })
      .in("id", orderIds)

    const events = orderIds.map(bookingId => ({
      booking_id:  bookingId,
      event_type:  "returned_to_warehouse",
      notes:       `Return run #${run.id.slice(0,8).toUpperCase()} · ${run.facility_name ?? ""} → warehouse · by ${completedBy}`,
      photo_url:   photoUrl,
      created_by:  completedBy,
    }))
    await supabase.from("order_events").insert(events)
  }

  // Mark run complete
  await supabase
    .from("transport_runs")
    .update({
      status:       "completed",
      completed_at: now,
      completed_by: completedBy,
      photo_url:    photoUrl,
    })
    .eq("id", runId)

  revalidatePath("/driver")
  revalidatePath("/operator")
  revalidatePath("/admin/runs")
  return { success: true }
}

// ── Fetch runs for admin ──────────────────────────────────────────────────────
export async function getTransportRuns(statusFilter: string[] = ["pending", "completed"]) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("transport_runs")
    .select("*")
    .in("status", statusFilter)
    .order("created_at", { ascending: false })
  return (data ?? []) as TransportRun[]
}

// ── Fetch pending runs for a role (driver/operator home pages) ────────────────
export async function getPendingRunsForRole(role: "driver" | "operator") {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("transport_runs")
    .select("*")
    .eq("status", "pending")
    .eq("assigned_role", role)
    .order("created_at", { ascending: true })
  return (data ?? []) as TransportRun[]
}

// ── Fetch a single run with its order details ─────────────────────────────────
export async function getTransportRunWithOrders(runId: string) {
  const supabase = createAdminClient()

  const { data: run } = await supabase
    .from("transport_runs")
    .select("*")
    .eq("id", runId)
    .single()

  if (!run) return null

  const orderIds: string[] = run.order_ids ?? []

  let orders: RunOrder[] = []
  if (orderIds.length > 0) {
    const { data } = await supabase
      .from("bookings")
      .select("id, short_code, customer_name, customer_address, num_bags, service_type, status")
      .in("id", orderIds)
    orders = (data ?? []) as RunOrder[]
  }

  return { run: run as TransportRun, orders }
}

// ── Facilities list for the admin runs page ───────────────────────────────────
export async function getActiveFacilities() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("facilities")
    .select("id, name, address")
    .eq("active", true)
    .order("name")
  return (data ?? []) as { id: string; name: string; address: string | null }[]
}

// ── Orders eligible to be added to a new run ──────────────────────────────────
export async function getEligibleOrdersForRun(runType: "to_facility" | "to_warehouse", facilityId?: string) {
  const supabase = createAdminClient()

  if (runType === "to_facility") {
    // Orders sitting at warehouse, not yet in any pending run
    const { data: pendingRuns } = await supabase
      .from("transport_runs")
      .select("order_ids")
      .eq("status", "pending")
      .eq("run_type", "to_facility")

    const alreadyInRun = new Set<string>(
      (pendingRuns ?? []).flatMap((r: { order_ids: string[] }) => r.order_ids)
    )

    const { data } = await supabase
      .from("bookings")
      .select("id, short_code, customer_name, customer_address, num_bags, service_type, status, actual_weight_lbs")
      .eq("status", "at_warehouse")
      .order("created_at")

    return (data ?? []).filter((b: { id: string }) => !alreadyInRun.has(b.id))
  } else {
    // Orders ready at a specific facility
    const { data: pendingRuns } = await supabase
      .from("transport_runs")
      .select("order_ids")
      .eq("status", "pending")
      .eq("run_type", "to_warehouse")

    const alreadyInRun = new Set<string>(
      (pendingRuns ?? []).flatMap((r: { order_ids: string[] }) => r.order_ids)
    )

    let query = supabase
      .from("bookings")
      .select("id, short_code, customer_name, customer_address, num_bags, service_type, status, actual_weight_lbs, assigned_facility_id")
      .eq("status", "ready")

    if (facilityId) {
      query = query.eq("assigned_facility_id", facilityId)
    }

    const { data } = await query.order("created_at")
    return (data ?? []).filter((b: { id: string }) => !alreadyInRun.has(b.id))
  }
}
