import { createAdminClient } from "@/lib/supabase/admin"
import { format, parseISO } from "date-fns"
import { revalidatePath } from "next/cache"
import { reschedulePickup, rescheduleDelivery, assignDriver, cancelShipdayOrders } from "@/app/actions/shipday"
import { DispatchOrderCard } from "@/components/admin/DispatchOrderCard"
import type { DispatchBooking as Booking } from "@/components/admin/DispatchOrderCard"
import { DispatchDateNav } from "@/components/admin/DispatchDateNav"

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
      : `Driver assignment attempted (${driverEmail}) -- carrier may not exist in Shipday`,
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

export default async function DispatchPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const { date: dateParam } = await searchParams
  // Use Eastern Time so "today" matches Orlando's date, not UTC
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date())
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

  const pickupAM    = allPickups.filter(b => b.pickup_time_window === "9am-1pm")
  const pickupPM    = allPickups.filter(b => b.pickup_time_window === "3pm-7pm")
  const pickupOther = allPickups.filter(b => b.pickup_time_window !== "9am-1pm" && b.pickup_time_window !== "3pm-7pm")
  const deliveryAM    = allDeliveries.filter(b => b.delivery_time_window === "9am-1pm")
  const deliveryPM    = allDeliveries.filter(b => b.delivery_time_window === "3pm-7pm")
  const deliveryOther = allDeliveries.filter(b => b.delivery_time_window !== "9am-1pm" && b.delivery_time_window !== "3pm-7pm")

  const totalSynced = [...allPickups, ...allDeliveries].filter(
    b => b.shipday_pickup_order_id || b.shipday_delivery_order_id
  ).length

  const displayDate = selectedDate === today
    ? `Today -- ${format(parseISO(selectedDate), "EEEE, MMMM d")}`
    : format(parseISO(selectedDate), "EEEE, MMMM d, yyyy")

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-8">

        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#0D2240]">Dispatch</h1>
            <p className="text-sm text-gray-400 mt-0.5">{displayDate}</p>
          </div>
          <DispatchDateNav selectedDate={selectedDate} today={today} />
        </div>

        <div className="grid grid-cols-4 gap-3 mb-8">
          {[
            { label: "Pickups", value: allPickups.length, color: "text-[#E8726A]" },
            { label: "Deliveries", value: allDeliveries.length, color: "text-blue-600" },
            { label: "Total Stops", value: allPickups.length + allDeliveries.length, color: "text-[#0D2240]" },
            { label: "Synced w/ Shipday", value: totalSynced, color: totalSynced > 0 ? "text-green-600" : "text-amber-500" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className={`text-3xl font-extrabold ${color}`}>{value}</p>
              <p className="text-xs text-gray-400 mt-0.5 font-semibold uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-2">

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
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">9AM - 1PM</p>
                <div className="space-y-3">
                  {pickupAM.map(b => (
                    <DispatchOrderCard key={b.id} booking={b} type="pickup" date={selectedDate}
                      assignDriverAction={assignDriverAction}
                      rescheduleAction={rescheduleAction}
                      cancelAction={cancelAction} />
                  ))}
                </div>
              </div>
            )}
            {pickupPM.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">3PM - 7PM</p>
                <div className="space-y-3">
                  {pickupPM.map(b => (
                    <DispatchOrderCard key={b.id} booking={b} type="pickup" date={selectedDate}
                      assignDriverAction={assignDriverAction}
                      rescheduleAction={rescheduleAction}
                      cancelAction={cancelAction} />
                  ))}
                </div>
              </div>
            )}
            {pickupOther.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">
                  {pickupOther[0].pickup_time_window || "Unscheduled"}
                </p>
                <div className="space-y-3">
                  {pickupOther.map(b => (
                    <DispatchOrderCard key={b.id} booking={b} type="pickup" date={selectedDate}
                      assignDriverAction={assignDriverAction}
                      rescheduleAction={rescheduleAction}
                      cancelAction={cancelAction} />
                  ))}
                </div>
              </div>
            )}
          </section>

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
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">9AM - 1PM</p>
                <div className="space-y-3">
                  {deliveryAM.map(b => (
                    <DispatchOrderCard key={b.id} booking={b} type="delivery" date={selectedDate}
                      assignDriverAction={assignDriverAction}
                      rescheduleAction={rescheduleAction}
                      cancelAction={cancelAction} />
                  ))}
                </div>
              </div>
            )}
            {deliveryPM.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">3PM - 7PM</p>
                <div className="space-y-3">
                  {deliveryPM.map(b => (
                    <DispatchOrderCard key={b.id} booking={b} type="delivery" date={selectedDate}
                      assignDriverAction={assignDriverAction}
                      rescheduleAction={rescheduleAction}
                      cancelAction={cancelAction} />
                  ))}
                </div>
              </div>
            )}
            {deliveryOther.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">
                  {deliveryOther[0].delivery_time_window || "Unscheduled"}
                </p>
                <div className="space-y-3">
                  {deliveryOther.map(b => (
                    <DispatchOrderCard key={b.id} booking={b} type="delivery" date={selectedDate}
                      assignDriverAction={assignDriverAction}
                      rescheduleAction={rescheduleAction}
                      cancelAction={cancelAction} />
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
