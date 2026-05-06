import { createAdminClient } from "@/lib/supabase/admin"
import { format, parseISO } from "date-fns"
import Link from "next/link"
import { revalidatePath } from "next/cache"
import { reschedulePickup, rescheduleDelivery, assignDriver, cancelShipdayOrders } from "@/app/actions/shipday"

async function assignDriverAction(formData: FormData) {
  "use server"
  const bookingId = formData.get("bookingId") as string
  const driverEmail = formData.get("driverEmail") as string
  const date = formData.get("date") as string
  const supabase = createAdminClient()
  const { ok } = await assignDriver(bookingId, driverEmail)
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

async function rescheduleAction(formData: FormData) {
  "use server"
  const bookingId = formData.get("bookingId") as string
  const type = formData.get("type") as string
  const newDate = formData.get("newDate") as string
  const newWindow = formData.get("newWindow") as string
  const currentDate = formData.get("currentDate") as string
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
  const date = formData.get("date") as string
  await cancelShipdayOrders(bookingId)
  revalidatePath(`/admin/dispatch?date=${date}`)
}

const SERVICE_LABELS: Record<string, string> = {
  wash_fold:      "Wash & Fold",
  wash_only:      "Wash Only",
  comforter_wash: "Comforter",
}

const STATUS_DOT: Record<string, string> = {
  confirmed:        "bg-blue-400",
  picked_up:        "bg-purple-400",
  in_progress:      "bg-orange-400",
  out_for_delivery: "bg-green-500",
  delivered:        "bg-gray-300",
  cancelled:        "bg-red-400",
}

type Booking = {
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
  assigned_facility: { name: string } | null
}

export default async function DispatchPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const { date: dateParam } = await searchParams
  const today = new Date().toISOString().split("T")[0]
  const selectedDate = dateParam ?? today

  const supabase = createAdminClient()

  const { data: pickups } = await supabase
    .from("bookings")
    .select(`
      id, short_code, customer_name, customer_address, customer_phone,
      pickup_date, pickup_time_window, delivery_date, delivery_time_window,
      service_type, num_bags, num_comforters, status,
      shipday_pickup_order_id, shipday_delivery_order_id,
      assigned_facility:facilities!assigned_facility_id(name)
    `)
    .eq("pickup_date", selectedDate)
    .not("status", "in", '("delivered","cancelled")')
    .order("pickup_time_window")

  const { data: deliveries } = await supabase
    .from("bookings")
    .select(`
      id, short_code, customer_name, customer_address, customer_phone,
      pickup_date, pickup_time_window, delivery_date, delivery_time_window,
      service_type, num_bags, num_comforters, status,
      shipday_pickup_order_id, shipday_delivery_order_id,
      assigned_facility:facilities!assigned_facility_id(name)
    `)
    .eq("delivery_date", selectedDate)
    .in("status", ["in_progress", "out_for_delivery", "picked_up"])
    .order("delivery_time_window")

  const allPickups = (pickups ?? []) as Booking[]
  const allDeliveries = (deliveries ?? []) as Booking[]

  const pickupAM = allPickups.filter(b => b.pickup_time_window === "9am-1pm")
  const pickupPM = allPickups.filter(b => b.pickup_time_window === "3pm-7pm")
  const deliveryAM = allDeliveries.filter(b => b.delivery_time_window === "9am-1pm")
  const deliveryPM = allDeliveries.filter(b => b.delivery_time_window === "3pm-7pm")

  const totalSynced = [...allPickups, ...allDeliveries].filter(
    b => b.shipday_pickup_order_id || b.shipday_delivery_order_id
  ).length

  const displayDate = selectedDate === today
    ? `Today — ${format(parseISO(selectedDate), "EEEE, MMMM d")}`
    : format(parseISO(selectedDate), "EEEE, MMMM d, yyyy")

  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      <div className="mx-auto max-w-6xl px-4 py-8">

        {/* Page header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#0D2240]">🚚 Dispatch</h1>
            <p className="text-sm text-gray-400 mt-0.5">{displayDate}</p>
          </div>

          {/* Date picker */}
          <form method="GET" className="flex items-center gap-2">
            <input
              type="date"
              name="date"
              defaultValue={selectedDate}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
            />
            <button type="submit"
              className="rounded-xl bg-[#0D2240] hover:bg-[#1a3a5c] text-white font-bold text-sm px-4 py-2 transition-colors">
              Go
            </button>
            {selectedDate !== today && (
              <a href="/admin/dispatch"
                className="rounded-xl border border-gray-200 text-gray-500 hover:text-[#0D2240] font-semibold text-sm px-4 py-2 transition-colors">
                Today
              </a>
            )}
          </form>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {[
            { label: "Pickups", value: allPickups.length, color: "text-[#E8726A]" },
            { label: "Deliveries", value: allDeliveries.length, color: "text-blue-600" },
            { label: "Total stops", value: allPickups.length + allDeliveries.length, color: "text-[#0D2240]" },
            { label: "Synced w/ Shipday", value: totalSynced, color: totalSynced > 0 ? "text-green-600" : "text-amber-500" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className={`text-3xl font-extrabold ${color}`}>{value}</p>
              <p className="text-xs text-gray-400 mt-0.5 font-semibold uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-2">

          {/* PICKUPS */}
          <section>
            <h2 className="font-extrabold text-[#0D2240] text-base mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E8726A] inline-block" />
              Pickups
              <span className="text-gray-400 font-normal text-sm">({allPickups.length})</span>
            </h2>

            {allPickups.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <p className="text-gray-400 text-sm">No pickups scheduled for this day.</p>
              </div>
            )}

            {pickupAM.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">9am – 1pm</p>
                <div className="space-y-3">
                  {pickupAM.map(b => (
                    <OrderCard key={b.id} booking={b} type="pickup" date={selectedDate}
                      assignDriverAction={assignDriverAction} rescheduleAction={rescheduleAction} cancelAction={cancelAction} />
                  ))}
                </div>
              </div>
            )}

            {pickupPM.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">3pm – 7pm</p>
                <div className="space-y-3">
                  {pickupPM.map(b => (
                    <OrderCard key={b.id} booking={b} type="pickup" date={selectedDate}
                      assignDriverAction={assignDriverAction} rescheduleAction={rescheduleAction} cancelAction={cancelAction} />
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* DELIVERIES */}
          <section>
            <h2 className="font-extrabold text-[#0D2240] text-base mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
              Deliveries
              <span className="text-gray-400 font-normal text-sm">({allDeliveries.length})</span>
            </h2>

            {allDeliveries.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <p className="text-gray-400 text-sm">No deliveries scheduled for this day.</p>
              </div>
            )}

            {deliveryAM.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">9am – 1pm</p>
                <div className="space-y-3">
                  {deliveryAM.map(b => (
                    <OrderCard key={b.id} booking={b} type="delivery" date={selectedDate}
                      assignDriverAction={assignDriverAction} rescheduleAction={rescheduleAction} cancelAction={cancelAction} />
                  ))}
                </div>
              </div>
            )}

            {deliveryPM.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">3pm – 7pm</p>
                <div className="space-y-3">
                  {deliveryPM.map(b => (
                    <OrderCard key={b.id} booking={b} type="delivery" date={selectedDate}
                      assignDriverAction={assignDriverAction} rescheduleAction={rescheduleAction} cancelAction={cancelAction} />
                  ))}
                </div>
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  )
}

function OrderCard({
  booking: b,
  type,
  date,
  assignDriverAction,
  rescheduleAction,
  cancelAction,
}: {
  booking: Booking
  type: "pickup" | "delivery"
  date: string
  assignDriverAction: (fd: FormData) => Promise<void>
  rescheduleAction: (fd: FormData) => Promise<void>
  cancelAction: (fd: FormData) => Promise<void>
}) {
  const orderCode = b.short_code ?? b.id.slice(0, 6).toUpperCase()
  const synced = type === "pickup" ? !!b.shipday_pickup_order_id : !!b.shipday_delivery_order_id
  const shipdayId = type === "pickup" ? b.shipday_pickup_order_id : b.shipday_delivery_order_id
  const bagCount = b.num_bags ?? b.num_comforters ?? 1
  const facility = b.assigned_facility as { name: string } | null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="px-4 py-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-black font-mono text-[#0D2240] text-sm">{orderCode}</span>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[b.status] ?? "bg-gray-300"}`} />
            <span className="text-xs text-gray-400 font-semibold">{b.status?.replace(/_/g, " ")}</span>
            <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              {SERVICE_LABELS[b.service_type] ?? b.service_type}
            </span>
            <span className="text-[10px] text-gray-400 font-semibold">
              {bagCount} bag{bagCount !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="font-semibold text-[#0D2240] text-sm truncate">{b.customer_name}</p>
          <p className="text-xs text-gray-400 truncate mt-0.5">{b.customer_address}</p>
          {facility && (
            <p className="text-[10px] text-purple-600 font-semibold mt-0.5">🏭 {facility.name}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {/* Shipday sync badge */}
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
            synced ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-600 border border-amber-200"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${synced ? "bg-green-500" : "bg-amber-400"}`} />
            {synced ? `SD #${shipdayId}` : "Not in Shipday"}
          </div>
          <Link href={`/admin/orders/${b.id}`}
            className="text-[10px] text-gray-400 hover:text-[#0D2240] font-semibold transition-colors">
            View order →
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="border-t border-gray-50 px-4 py-3 bg-[#fafbfd] flex gap-3 flex-wrap">

        {/* Assign driver */}
        <form action={assignDriverAction} className="flex gap-1.5 flex-1 min-w-[180px]">
          <input type="hidden" name="bookingId" value={b.id} />
          <input type="hidden" name="date" value={date} />
          <input
            type="email"
            name="driverEmail"
            placeholder="driver@email.com"
            required
            disabled={!synced}
            className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-[#0D2240] placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-[#E8726A]/40 disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!synced}
            className="rounded-lg bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[10px] px-2.5 py-1.5 transition-colors whitespace-nowrap"
          >
            Assign
          </button>
        </form>

        {/* Reschedule */}
        <details className="group">
          <summary className="cursor-pointer text-[10px] text-gray-400 hover:text-[#0D2240] font-semibold transition-colors list-none px-1 py-1.5">
            Reschedule…
          </summary>
          <div className="mt-2 p-2 bg-white rounded-xl border border-gray-100 shadow-sm absolute z-10 w-56">
            <form action={rescheduleAction} className="space-y-1.5">
              <input type="hidden" name="bookingId" value={b.id} />
              <input type="hidden" name="type" value={type} />
              <input type="hidden" name="currentDate" value={date} />
              <input
                type="date"
                name="newDate"
                defaultValue={type === "pickup" ? b.pickup_date : b.delivery_date}
                required
                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-[#0D2240] focus:outline-none"
              />
              <select
                name="newWindow"
                defaultValue={type === "pickup" ? b.pickup_time_window : b.delivery_time_window}
                required
                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-[#0D2240] focus:outline-none"
              >
                <option value="9am-1pm">9am – 1pm</option>
                <option value="3pm-7pm">3pm – 7pm</option>
              </select>
              <button type="submit"
                className="w-full rounded-lg bg-[#0D2240] hover:bg-[#1a3a5c] text-white font-bold text-[10px] py-1.5 transition-colors">
                {synced ? `Update → Shipday` : "Update date"}
              </button>
            </form>
          </div>
        </details>

        {/* Cancel Shipday */}
        {synced && (
          <form action={cancelAction}>
            <input type="hidden" name="bookingId" value={b.id} />
            <input type="hidden" name="date" value={date} />
            <button
              type="submit"
              className="rounded-lg border border-red-200 text-red-400 hover:bg-red-50 font-bold text-[10px] px-2.5 py-1.5 transition-colors"
              onClick={(e) => { if (!confirm("Remove from Shipday routing?")) e.preventDefault() }}
            >
              Remove from routing
            </button>
          </form>
        )}

      </div>
    </div>
  )
}
