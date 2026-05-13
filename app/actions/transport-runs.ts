"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { createShipdayRunOrder } from "@/lib/shipday"
import { todayET } from "@/lib/date-et"
import { getAllFacilityWindows } from "@/app/actions/facility-windows"
import { isWithinAccessWindow } from "@/lib/facility-utils"
import { getLocationId } from "@/lib/location"

export interface TransportRun {
  id: string
  location_id: string | null
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
  shipday_order_id: number | null
  processing_mode: 'own_operator' | 'partner_attendant' | null
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
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]

  const runType     = formData.get("runType")    as "to_facility" | "to_warehouse"
  const facilityId  = formData.get("facilityId") as string
  const assignedTo  = formData.get("assignedTo") as string
  const assignedRole= formData.get("assignedRole") as "driver" | "operator"
  const notes       = (formData.get("notes") as string) || null
  const orderIdsRaw      = formData.get("orderIds")        as string  // comma-separated UUIDs
  const processingMode   = (formData.get("processingMode") as string) || null

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
      location_id:   locationId,
      run_type:      runType,
      facility_id:   facilityId,
      facility_name: facility?.name ?? null,
      assigned_to:   assignedTo,
      assigned_role: assignedRole,
      order_ids:        orderIds,
      notes,
      status:           "pending",
      processing_mode:  processingMode,
    })
    .select()
    .single()

  if (error) {
    console.error("[transport-runs] create error:", error)
    return { error: "Failed to create run" }
  }

  // ── Push to Shipday so driver sees it in their app ─────────────────────────
  try {
    // Fetch warehouse address from settings
    const { data: warehouseSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("location_id", locationId)
      .eq("key", "warehouse_address")
      .single()
    const warehouseAddress = warehouseSetting?.value ?? process.env.BUSINESS_ADDRESS ?? "Orlando, FL"

    // Fetch facility address
    const { data: facilityData } = await supabase
      .from("facilities")
      .select("name, address")
      .eq("id", facilityId)
      .single()

    const facilityAddress = facilityData?.address ?? run.facility_name ?? "Facility"
    const facilityName    = facilityData?.name    ?? run.facility_name ?? "Facility"

    const fromAddress = runType === "to_facility" ? warehouseAddress : facilityAddress
    const toAddress   = runType === "to_facility" ? facilityAddress  : warehouseAddress

    const orderSummary = `${orderIds.length} order${orderIds.length !== 1 ? "s" : ""} · assigned to ${assignedTo}`

    const today = todayET()

    const shipdayOrderId = await createShipdayRunOrder({
      runId:        run.id,
      runType,
      facilityName,
      fromAddress,
      toAddress,
      orderSummary,
      runDate:      today,
    })

    if (shipdayOrderId) {
      await supabase
        .from("transport_runs")
        .update({ shipday_order_id: shipdayOrderId })
        .eq("id", run.id)
      run.shipday_order_id = shipdayOrderId
    }
  } catch (err) {
    console.error("[transport-runs] Shipday run order failed (non-fatal):", err)
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

// ── Execute a facility transfer run (driver or operator) ─────────────────────
// Advances ALL orders in the run to their next status/phase and assigns facility where needed.
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
    // ── Storage → Facility ─────────────────────────────────────────
    // Orders: at_warehouse → at_facility (status), at_storage → intake (phase)
    // Also sets assigned_facility_id and calculates facility cost

    // Get facility config for cost calc + arrival notification
    const { data: facility } = await supabase
      .from("facilities")
      .select("rate_per_lb, minimum_lbs, supports_own_operator, contact_email, name")
      .eq("id", run.facility_id)
      .single()

    // Use the mode set when the run was created; fall back to facility default
    const facilityProcessingMode: string = run.processing_mode
      ?? (facility?.supports_own_operator === false ? "partner_attendant" : "own_operator")

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
          phase:                     "intake",
          phase_updated_at:          now,
          phase_updated_by:          null,
          assigned_facility_id:      run.facility_id,
          facility_processing_mode:  facilityProcessingMode,
          facility_cost_cents:       facilityCostCents,
        })
        .eq("id", bk.id)
    }

    // Log phase transitions
    const phaseTransitions = orderIds.map(bookingId => ({
      booking_id:   bookingId,
      location_id:  run.location_id,
      from_phase:   "at_storage",
      to_phase:     "intake",
      worker_name:  completedBy,
      source:       "facility_transfer",
    }))
    await supabase.from("phase_transitions").insert(phaseTransitions)

    // Log event on each order
    const events = orderIds.map(bookingId => ({
      booking_id:  bookingId,
      event_type:  "transferred_to_facility",
      notes:       `Facility transfer #${run.id.slice(0,8).toUpperCase()} · storage → ${run.facility_name ?? run.facility_id} · by ${completedBy}`,
      photo_url:   photoUrl,
      created_by:  completedBy,
    }))
    await supabase.from("order_events").insert(events)

    // ── Send arrival notification to partner facility ──────────────
    if (facilityProcessingMode === "partner_attendant" && facility?.contact_email) {
      const { data: orderDetails } = await supabase
        .from("bookings")
        .select("short_code, customer_name, service_type, num_bags")
        .in("id", orderIds)

      if (orderDetails?.length) {
        const SERVICE_LABEL: Record<string, string> = {
          wash_fold:      "Wash & Fold",
          wash_only:      "Wash Only",
          comforter_wash: "Comforter",
        }
        const arrivedAt = new Date().toLocaleTimeString("en-US", {
          hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/New_York",
        })
        import("@/lib/email").then(({ sendFacilityArrivalEmail }) =>
          sendFacilityArrivalEmail(facility.contact_email!, {
            facilityName: facility.name ?? run.facility_name ?? "Facility",
            driverName:   completedBy,
            arrivedAt,
            orders: orderDetails.map(o => ({
              shortCode:    o.short_code,
              customerName: o.customer_name,
              serviceType:  SERVICE_LABEL[o.service_type] ?? o.service_type,
              bags:         o.num_bags ?? 1,
            })),
          }).catch(err => console.error("[transport-runs] Facility arrival email failed:", err))
        )
      }
    }

  } else {
    // ── Facility → Storage ─────────────────────────────────────────
    // Orders: ready → ready_at_warehouse (status), ready → staged (phase)
    // "staged" = back at storage, awaiting delivery route — distinct from
    // "at_storage" which means fresh pickup waiting for facility transfer.

    await supabase
      .from("order_bags")
      .update({ status: "ready_at_warehouse" })
      .in("booking_id", orderIds)
      .eq("status", "ready")

    await supabase
      .from("bookings")
      .update({
        status:           "ready_at_warehouse",
        phase:            "staged",
        phase_updated_at: now,
        phase_updated_by: null,
      })
      .in("id", orderIds)

    // Log phase transitions
    const phaseTransitions = orderIds.map(bookingId => ({
      booking_id:   bookingId,
      location_id:  run.location_id,
      from_phase:   "ready",
      to_phase:     "staged",
      worker_name:  completedBy,
      source:       "facility_transfer",
    }))
    await supabase.from("phase_transitions").insert(phaseTransitions)

    const events = orderIds.map(bookingId => ({
      booking_id:  bookingId,
      event_type:  "returned_to_storage",
      notes:       `Return transfer #${run.id.slice(0,8).toUpperCase()} · ${run.facility_name ?? ""} → storage · by ${completedBy}`,
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
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase
    .from("transport_runs")
    .select("*")
    .eq("location_id", locationId)
    .in("status", statusFilter)
    .order("created_at", { ascending: false })
  return (data ?? []) as TransportRun[]
}

// ── Fetch pending runs for a role (driver/operator home pages) ────────────────
export async function getPendingRunsForRole(role: "driver" | "operator") {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase
    .from("transport_runs")
    .select("*")
    .eq("location_id", locationId)
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
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase
    .from("facilities")
    .select("id, name, address, supports_own_operator, supports_partner_attendant")
    .eq("location_id", locationId)
    .eq("active", true)
    .order("name")
  return (data ?? []) as { id: string; name: string; address: string | null; supports_own_operator: boolean; supports_partner_attendant: boolean }[]
}

// ── Orders eligible to be added to a new run ──────────────────────────────────
export async function getEligibleOrdersForRun(runType: "to_facility" | "to_warehouse", facilityId?: string) {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]

  if (runType === "to_facility") {
    // Orders sitting at warehouse, not yet in any pending run
    const { data: pendingRuns } = await supabase
      .from("transport_runs")
      .select("order_ids")
      .eq("location_id", locationId)
      .eq("status", "pending")
      .eq("run_type", "to_facility")

    const alreadyInRun = new Set<string>(
      (pendingRuns ?? []).flatMap((r: { order_ids: string[] }) => r.order_ids)
    )

    const { data } = await supabase
      .from("bookings")
      .select("id, short_code, customer_name, customer_address, num_bags, service_type, status, phase, actual_weight_lbs")
      .eq("location_id", locationId)
      .or("status.eq.at_warehouse,phase.eq.at_storage")
      .order("created_at")

    return (data ?? []).filter((b: { id: string }) => !alreadyInRun.has(b.id))
  } else {
    // Orders ready at a specific facility
    const { data: pendingRuns } = await supabase
      .from("transport_runs")
      .select("order_ids")
      .eq("location_id", locationId)
      .eq("status", "pending")
      .eq("run_type", "to_warehouse")

    const alreadyInRun = new Set<string>(
      (pendingRuns ?? []).flatMap((r: { order_ids: string[] }) => r.order_ids)
    )

    let query = supabase
      .from("bookings")
      .select("id, short_code, customer_name, customer_address, num_bags, service_type, status, actual_weight_lbs, assigned_facility_id")
      .eq("location_id", locationId)
      .eq("status", "ready")

    if (facilityId) {
      query = query.eq("assigned_facility_id", facilityId)
    }

    const { data } = await query.order("created_at")
    return (data ?? []).filter((b: { id: string }) => !alreadyInRun.has(b.id))
  }
}

// ── Check if a facility is currently within its access windows ────────────────
export async function checkFacilityAccessNow(facilityId: string): Promise<{
  accessible: boolean
  windows: { label: string | null; days_of_week: number[]; start_time: string; end_time: string; overnight: boolean }[]
}> {
  const allWindows = await getAllFacilityWindows()
  const windows = allWindows.filter(w => w.facility_id === facilityId)
  const accessible = isWithinAccessWindow(windows)
  return { accessible, windows }
}
