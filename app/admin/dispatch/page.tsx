import { createAdminClient } from "@/lib/supabase/admin"
import { format, parseISO } from "date-fns"
import { revalidatePath } from "next/cache"
import { reschedulePickup, rescheduleDelivery, assignDriver, cancelShipdayOrders } from "@/app/actions/shipday"
import { SeedDispatchButton } from "@/components/admin/SeedDispatchButton"
import { DispatchBoard } from "@/components/admin/DispatchBoard"
import { OperatorDispatch } from "@/components/admin/OperatorDispatch"

// ─── Server Actions ───────────────────────────────────────────────────────────

async function assignDriverAction(formData: FormData) {
  "use server"
  const bookingId   = formData.get("bookingId")   as string
  const driverEmail = formData.get("driverEmail")  as string
  const driverId    = formData.get("driverId")     as string
  const date        = formData.get("date")         as string
  const supabase    = createAdminClient()

  const { ok } = await assignDriver(bookingId, driverEmail)
  await supabase.from("bookings").update({ assigned_driver_id: driverId || null }).eq("id", bookingId)
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
  const bookingId = formData.get("bookingId") as string
  const date      = formData.get("date")      as string
  const supabase  = createAdminClient()
  await supabase.from("bookings").update({ assigned_driver_id: null }).eq("id", bookingId)
  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: "driver_unassigned",
    notes: "Driver unassigned by dispatcher",
    created_by: "admin",
  })
  revalidatePath(`/admin/dispatch?date=${date}`)
}

async function assignOperatorAction(formData: FormData) {
  "use server"
  const bookingId   = formData.get("bookingId")   as string
  const operatorId  = formData.get("operatorId")  as string
  const date        = formData.get("date")         as string
  const supabase    = createAdminClient()
  await supabase.from("bookings").update({ assigned_operator_id: operatorId || null }).eq("id", bookingId)
  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: "operator_assigned",
    notes: operatorId ? `Operator assigned: ${operatorId}` : "Operator unassigned",
    created_by: "admin",
  })
  revalidatePath(`/admin/dispatch?date=${date}`)
}

async function rescheduleAction(formData: FormData) {
  "use server"
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
  const { tab: tabParam } = await searchParams
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date())
  const activeTab = tabParam === "operators" ? "operators" : "drivers"

  const supabase = createAdminClient()

  // Workers
  const { data: activeDrivers } = await supabase
    .from("workers")
    .select("id, name, shipday_email")
    .eq("status", "active")
    .contains("roles", ["driver"])
    .order("name")

  const { data: activeOperators } = await supabase
    .from("workers")
    .select("id, name")
    .eq("status", "active")
    .contains("roles", ["operator"])
    .order("name")

  const { data: facilities } = await supabase
    .from("facilities")
    .select("id, name")
    .order("name")

  const drivers   = (activeDrivers   ?? []) as { id: string; name: string; shipday_email: string | null }[]
  const operators = (activeOperators ?? []) as { id: string; name: string }[]

  // DRIVER-relevant orders — all statuses that require a driver action:
  // confirmed       → pick up from customer → bring to facility
  // picked_up       → en route to facility (driver has it)
  // at_warehouse    → storage warehouse, driver needs to bring to facility
  // ready           → folded at facility, driver delivers or transfers to warehouse
  // out_for_delivery→ driver delivering to customer
  const DRIVER_STATUSES = ["confirmed", "picked_up", "at_warehouse", "ready", "out_for_delivery"]

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
    .in("status", DRIVER_STATUSES)
    .order("pickup_date")

  // Split for stats
  const pickups   = (driverOrders ?? []).filter(b => ["confirmed", "picked_up"].includes(b.status)) as DispatchBooking[]
  const transfers = (driverOrders ?? []).filter(b => ["at_warehouse", "ready"].includes(b.status)) as DispatchBooking[]
  const deliveries = (driverOrders ?? []).filter(b => b.status === "out_for_delivery") as DispatchBooking[]
  const allDriverOrders = (driverOrders ?? []) as DispatchBooking[]

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

  // allPickups / allDeliveries / allDriverOrders already set above
  const allFacilityOrders = (facilityOrders ?? []) as FacilityOrder[]

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
            { label: "Transfers",   value: transfers.length,          color: "text-amber-500"  },
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
            { id: "drivers",   label: "🚗 Driver Routes" },
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
}
