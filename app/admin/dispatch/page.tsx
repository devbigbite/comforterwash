import { createAdminClient } from "@/lib/supabase/admin"
import { format, parseISO } from "date-fns"
import { revalidatePath } from "next/cache"
import { reschedulePickup, rescheduleDelivery, assignDriver, cancelShipdayOrders } from "@/app/actions/shipday"
import { SeedDispatchButton } from "@/components/admin/SeedDispatchButton"
import { DispatchBoard } from "@/components/admin/DispatchBoard"
import { OperatorDispatch } from "@/components/admin/OperatorDispatch"
import { TransferRunsPanel } from "@/components/admin/TransferRunsPanel"
import { AerialView } from "@/components/admin/AerialView"
import type { AerialOrder } from "@/types/dispatch"
import { getTransportRuns } from "@/app/actions/transport-runs"
import type { TransportRun } from "@/app/actions/transport-runs"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"

// ─── Server Actions ───────────────────────────────────────────────────────────
// Every action below verifies bookingId/runId belongs to the current tenant
// before mutating, so a dispatcher session for one tenant can't touch
// another tenant's orders/runs even if it knew the id.

async function assignDriverAction(formData: FormData) {
  "use server"
  await requireAdmin()
  const bookingId   = formData.get("bookingId")   as string
  const driverEmail = formData.get("driverEmail")  as string
  const driverId    = formData.get("driverId")     as string
  const date        = formData.get("date")         as string
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]

  const { ok } = await assignDriver(bookingId, driverEmail)
  await supabase.from("bookings").update({ assigned_driver_id: driverId || null }).eq("id", bookingId).eq("location_id", locationId)
  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: "driver_assigned",
    notes: ok
      ? `Driver assigned in Shipday: ${driverEmail}`
      : `Driver assignment attempted (${driverEmail}) — carrier may not exist in Shipday`,
    created_by: "admin",
  })
  revalidatePath(`/admin/dispatch?date=${date}`)
}

async function unassignDriverAction(formData: FormData) {
  "use server"
  await requireAdmin()
  const bookingId = formData.get("bookingId") as string
  const date      = formData.get("date")      as string
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("bookings").update({ assigned_driver_id: null }).eq("id", bookingId).eq("location_id", locationId)
  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: "driver_unassigned",
    notes: "Driver unassigned by dispatcher",
    created_by: "admin",
  })
  revalidatePath(`/admin/dispatch?date=${date}`)
}

// Operational dispatcher moves for a driver's order — no billing/Stripe
// side effects. This intentionally does NOT touch weight, pricing, or
// payment capture; that only ever happens through the driver app's own
// dropoff/delivery flow. Two flavors:
//   - route changes (send to facility/warehouse, start delivery, delivered,
//     go back a step) just update status.
//   - "remove from driver" also clears the assignment, e.g. the customer
//     calls to say they didn't leave items out for pickup.
async function driverQuickActionAdmin(formData: FormData) {
  "use server"
  await requireAdmin()
  const bookingId = formData.get("bookingId") as string
  const status    = formData.get("status")    as string
  const note      = formData.get("note")      as string
  const unassign  = formData.get("unassign")  === "true"
  const date      = formData.get("date")      as string
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]

  const updates: Record<string, unknown> = { status }
  if (unassign) updates.assigned_driver_id = null

  await supabase.from("bookings").update(updates).eq("id", bookingId).eq("location_id", locationId)
  await supabase.from("order_bags").update({ status }).eq("booking_id", bookingId)
  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: unassign ? "removed_from_driver" : "dispatcher_status_change",
    notes: note || `Status set to "${status}" by dispatcher`,
    created_by: "admin",
  })
  revalidatePath(`/admin/dispatch?date=${date}`)
}

async function assignRunDriverAction(runId: string, driverName: string) {
  "use server"
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("transport_runs").update({ assigned_to: driverName }).eq("id", runId).eq("location_id", locationId)
  revalidatePath("/admin/dispatch")
}

async function assignOperatorAction(formData: FormData) {
  "use server"
  await requireAdmin()
  const bookingId   = formData.get("bookingId")   as string
  const operatorId  = formData.get("operatorId")  as string
  const date        = formData.get("date")         as string
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("bookings").update({ assigned_operator_id: operatorId || null }).eq("id", bookingId).eq("location_id", locationId)
  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: "operator_assigned",
    notes: operatorId ? `Operator assigned: ${operatorId}` : "Operator unassigned",
    created_by: "admin",
  })
  revalidatePath(`/admin/dispatch?date=${date}`)
}

async function setOrderStageAdminAction(formData: FormData) {
  "use server"
  await requireAdmin()
  const bookingId = formData.get("bookingId") as string
  const stage     = formData.get("stage")     as string
  const supabase  = createAdminClient()
  await supabase.from("order_bags").update({ status: stage }).eq("booking_id", bookingId)
  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: "stage_reset",
    notes: `Stage set to "${stage}" by dispatcher`,
    created_by: "admin",
  })
  revalidatePath("/admin/dispatch")
}

async function rescheduleAction(formData: FormData) {
  "use server"
  await requireAdmin()
  const bookingId   = formData.get("bookingId")   as string
  const type        = formData.get("type")         as string
  const newDate     = formData.get("newDate")      as string
  const newWindow   = formData.get("newWindow")    as string
  const currentDate = formData.get("currentDate")  as string
  if (type === "pickup") {
    await reschedulePickup(bookingId, newDate, newWindow)
  } else {
    await rescheduleDelivery(bookingId, newDate, newWindow)
  }
  revalidatePath(`/admin/dispatch?date=${currentDate}`)
}

async function cancelAction(formData: FormData) {
  "use server"
  await requireAdmin()
  const bookingId = formData.get("bookingId") as string
  const date      = formData.get("date")      as string
  await cancelShipdayOrders(bookingId)
  revalidatePath(`/admin/dispatch?date=${date}`)
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function DispatchPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  await requireAdmin()
  const { tab: tabParam } = await searchParams
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date())
  const activeTab = tabParam === "operators" ? "operators" : tabParam === "transfers" ? "transfers" : tabParam === "aerial" ? "aerial" : "drivers"

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]

  // Workers
  const { data: activeDrivers } = await supabase
    .from("workers")
    .select("id, name, shipday_email")
    .eq("location_id", locationId)
    .eq("status", "active")
    .contains("roles", ["driver"])
    .order("name")

  const { data: activeOperators } = await supabase
    .from("workers")
    .select("id, name")
    .eq("location_id", locationId)
    .eq("status", "active")
    .contains("roles", ["operator"])
    .order("name")

  const { data: facilities } = await supabase
    .from("facilities")
    .select("id, name")
    .eq("location_id", locationId)
    .order("name")

  const drivers   = (activeDrivers   ?? []) as { id: string; name: string; shipday_email: string | null }[]
  const operators = (activeOperators ?? []) as { id: string; name: string }[]

  // DRIVER-relevant orders — all statuses that require a driver action:
  // confirmed       → pick up from customer → bring to facility
  // picked_up       → en route to facility (driver has it)
  // at_warehouse    → storage warehouse, driver needs to bring to facility
  // ready           → folded at facility, driver delivers or transfers to warehouse
  // out_for_delivery→ driver delivering to customer
  // Transfer statuses (ready, at_warehouse, ready_at_warehouse) are handled via transport runs tab
  const DRIVER_STATUSES = ["confirmed", "picked_up", "out_for_delivery"]

  const { data: driverOrders } = await supabase
    .from("bookings")
    .select(`
      id, short_code, customer_name, customer_address, customer_phone,
      pickup_date, pickup_time_window, delivery_date, delivery_time_window,
      service_type, num_bags, num_comforters, status,
      shipday_pickup_order_id, shipday_delivery_order_id,
      assigned_driver_id, assigned_operator_id,
      assigned_facility:facilities!assigned_facility_id(id, name)
    `)
    .eq("location_id", locationId)
    .in("status", DRIVER_STATUSES)
    .order("pickup_date")

  // Pending transport runs for transfer tab
  const transportRuns = await getTransportRuns(["pending"]) as TransportRun[]

  // Split for stats
  const pickups         = (driverOrders ?? []).filter(b => ["confirmed", "picked_up"].includes(b.status)) as DispatchBooking[]
  const deliveries      = (driverOrders ?? []).filter(b => b.status === "out_for_delivery") as DispatchBooking[]
  const allDriverOrders = (driverOrders ?? []) as DispatchBooking[]

  // All active orders for aerial view
  const { data: aerialData } = await supabase
    .from("bookings")
    .select(`
      id, short_code, customer_name, service_type, num_bags, num_comforters, status,
      assigned_facility:facilities!assigned_facility_id(name),
      assigned_driver:workers!assigned_driver_id(name)
    `)
    .eq("location_id", locationId)
    .not("status", "in", '("delivered","cancelled")')
    .order("created_at", { ascending: false })

  const aerialOrders = (aerialData ?? []) as AerialOrder[]
  const aerialOrdersById = Object.fromEntries(aerialOrders.map(o => [o.id, o]))

  // In-progress orders for operator dispatch (at facility)
  const { data: facilityOrders } = await supabase
    .from("bookings")
    .select(`
      id, short_code, customer_name, service_type, num_bags, num_comforters, status,
      assigned_operator_id,
      assigned_facility:facilities!assigned_facility_id(id, name)
    `)
    .in("status", ["in_progress", "picked_up"])
    .not("assigned_facility_id", "is", null)
    .order("customer_name")

  // Current bag-level stage per order, so dispatchers can see and roll back
  // exactly what an operator would see/do on their station screen.
  const facilityOrderIds = (facilityOrders ?? []).map(o => o.id)
  const { data: facilityBags } = facilityOrderIds.length
    ? await supabase.from("order_bags").select("booking_id, status").in("booking_id", facilityOrderIds)
    : { data: [] as { booking_id: string; status: string }[] }

  const STAGE_ORDER = ["at_facility", "in_washer", "in_dryer", "folded", "ready"]
  const stageByBooking = new Map<string, string | null>()
  for (const id of facilityOrderIds) {
    const statuses = (facilityBags ?? []).filter(b => b.booking_id === id).map(b => b.status)
    const mostAdvanced = statuses.length
      ? [...statuses].sort((a, z) => STAGE_ORDER.indexOf(z) - STAGE_ORDER.indexOf(a))[0]
      : null
    stageByBooking.set(id, mostAdvanced)
  }

  // allPickups / allDeliveries / allDriverOrders already set above
  const allFacilityOrders = (facilityOrders ?? []).map(o => ({
    ...o,
    current_stage: stageByBooking.get(o.id) ?? null,
  })) as FacilityOrder[]

  const totalSynced = allDriverOrders.filter(
    b => b.shipday_pickup_order_id || b.shipday_delivery_order_id
  ).length

  const displayDate = `Today — ${format(parseISO(today), "EEEE, MMMM d, yyyy")}`

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-[#0D2240]">Dispatch</h1>
            <p className="text-sm text-gray-400 mt-0.5">{displayDate}</p>
          </div>
          <SeedDispatchButton />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "Pickups",     value: pickups.length,           color: "text-[#E8726A]"  },
            { label: "Transfers",   value: transportRuns.length,      color: "text-amber-500"  },
            { label: "Deliveries",  value: deliveries.length,         color: "text-blue-600"   },
            { label: "At Facility", value: allFacilityOrders.length,  color: "text-purple-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className={`text-3xl font-extrabold ${color}`}>{value}</p>
              <p className="text-xs text-gray-400 mt-0.5 font-semibold uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl border border-gray-100 shadow-sm p-1 w-fit">
          {[
            { id: "aerial",    label: "🗺️ Aerial View" },
            { id: "drivers",   label: "🚗 Driver Routes" },
            { id: "transfers", label: "📦 Transfer Runs" },
            { id: "operators", label: "🏭 Operator Assignments" },
          ].map(t => (
            <a
              key={t.id}
              href={`?tab=${t.id}`}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                activeTab === t.id
                  ? "bg-[#0D2240] text-white"
                  : "text-gray-400 hover:text-[#0D2240]"
              }`}
            >
              {t.label}
            </a>
          ))}
        </div>

        {/* Aerial view tab */}
        {activeTab === "aerial" && (
          <AerialView
            orders={aerialOrders}
            runs={transportRuns}
            allOrdersById={aerialOrdersById}
          />
        )}

        {/* Driver tab */}
        {activeTab === "drivers" && (
          <DispatchBoard
            date={today}
            pickups={allDriverOrders}
            deliveries={[]}
            drivers={drivers}
            assignDriverAction={assignDriverAction}
            unassignDriverAction={unassignDriverAction}
            rescheduleAction={rescheduleAction}
            cancelAction={cancelAction}
            setBookingStatusAction={driverQuickActionAdmin}
          />
        )}

        {/* Transfers tab */}
        {activeTab === "transfers" && (
          <TransferRunsPanel
            runs={transportRuns}
            drivers={drivers}
            assignRunDriverAction={assignRunDriverAction}
          />
        )}

        {/* Operator tab */}
        {activeTab === "operators" && (
          <OperatorDispatch
            date={today}
            orders={allFacilityOrders}
            operators={operators}
            facilities={(facilities ?? []) as { id: string; name: string }[]}
            assignOperatorAction={assignOperatorAction}
            setOrderStageAction={setOrderStageAdminAction}
          />
        )}

      </div>
    </div>
  )
}

// ─── Types (shared with client components) ───────────────────────────────────

export type DispatchBooking = {
  id: string
  short_code: string | null
  customer_name: string
  customer_address: string
  customer_phone: string
  pickup_date: string
  pickup_time_window: string
  delivery_date: string
  delivery_time_window: string
  service_type: string
  num_bags: number | null
  num_comforters: number | null
  status: string
  shipday_pickup_order_id: number | null
  shipday_delivery_order_id: number | null
  assigned_driver_id: string | null
  assigned_operator_id: string | null
  assigned_facility: { id: string; name: string } | null
}

export type FacilityOrder = {
  id: string
  short_code: string | null
  customer_name: string
  service_type: string
  num_bags: number | null
  num_comforters: number | null
  status: string
  assigned_operator_id: string | null
  assigned_facility: { id: string; name: string } | null
  current_stage: string | null
}
