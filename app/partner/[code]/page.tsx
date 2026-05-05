import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import { revalidatePath } from "next/cache"

const OPERATOR_ZONE = ["at_facility", "in_washer", "in_dryer", "folded"]

async function markOrderReady(formData: FormData) {
  "use server"
  const bookingId = formData.get("bookingId") as string
  const facilityCode = formData.get("facilityCode") as string

  const supabase = createAdminClient()

  // Advance all operator-zone bags to ready
  const { data: bags } = await supabase
    .from("order_bags")
    .select("id, status")
    .eq("booking_id", bookingId)
    .in("status", OPERATOR_ZONE)

  if (!bags?.length) return

  await supabase
    .from("order_bags")
    .update({ status: "ready" })
    .eq("booking_id", bookingId)
    .in("status", OPERATOR_ZONE)

  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: "ready_for_delivery",
    notes: `Marked ready by facility partner (${bags.length} bag${bags.length === 1 ? "" : "s"})`,
    created_by: "partner_attendant",
  })

  revalidatePath(`/partner/${facilityCode}`)
}

export default async function PartnerPortalPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = createAdminClient()

  // Fetch facility by access code
  const { data: facility } = await supabase
    .from("facilities")
    .select("*")
    .eq("partner_access_code", code)
    .eq("active", true)
    .single()

  if (!facility) notFound()

  // Orders assigned to this facility in operator zone or ready (recently completed)
  const { data: bookings } = await supabase
    .from("bookings")
    .select(`
      id, customer_name, service_type, pickup_date, delivery_date,
      actual_weight_lbs, weight_entered_by,
      order_bags(id, status, bag_number, label_code)
    `)
    .eq("assigned_facility_id", facility.id)
    .order("pickup_date", { ascending: true })

  // Split into active (operator zone) and recently done (ready/out/delivered)
  const active = (bookings ?? []).filter(b =>
    (b.order_bags as Array<{ status: string }>)?.some(bag => OPERATOR_ZONE.includes(bag.status))
  )
  const done = (bookings ?? []).filter(b => {
    const statuses = (b.order_bags as Array<{ status: string }>)?.map(bag => bag.status) ?? []
    return statuses.length > 0 && statuses.every(s => ["ready", "out_for_delivery", "delivered"].includes(s))
  })

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm font-medium">WashFold Partner Portal</p>
            <h1 className="text-2xl font-extrabold mt-0.5">{facility.name}</h1>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">{today}</p>
            <p className="text-lg font-bold text-[#E8726A] mt-0.5">
              {active.length} order{active.length === 1 ? "" : "s"} to process
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-10">

        {/* Active orders */}
        <section>
          <h2 className="text-lg font-bold text-gray-300 mb-4 uppercase tracking-widest text-sm">
            📋 Needs Processing ({active.length})
          </h2>

          {active.length === 0 ? (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-10 text-center">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-gray-400 font-semibold">No orders pending — you&apos;re all caught up!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {active.map((booking) => {
                const bags = booking.order_bags as Array<{ id: string; status: string; bag_number: number; label_code: string }>
                const inZone = bags.filter(b => OPERATOR_ZONE.includes(b.status))
                const orderCode = booking.id.slice(0, 8).toUpperCase()
                const weight = booking.actual_weight_lbs as number | null
                const isWashFold = booking.service_type === "wash_fold"

                return (
                  <div key={booking.id} className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
                    {/* Order header */}
                    <div className="px-6 py-5 border-b border-gray-800 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-[#E8726A]/10 border border-[#E8726A]/20 flex items-center justify-center shrink-0">
                          <span className="text-2xl">{isWashFold ? "🧺" : "🛏️"}</span>
                        </div>
                        <div>
                          <p className="font-extrabold text-xl">{booking.customer_name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs font-mono bg-gray-800 text-gray-300 px-2 py-0.5 rounded-lg">
                              {orderCode}
                            </span>
                            <span className="text-xs font-bold text-gray-400">
                              {isWashFold ? "Wash & Fold" : "Comforter Wash"}
                            </span>
                            <span className="text-xs text-gray-500">
                              Deliver by {booking.delivery_date}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-3xl font-extrabold text-white">{inZone.length}</p>
                        <p className="text-gray-400 text-sm">bag{inZone.length === 1 ? "" : "s"}</p>
                      </div>
                    </div>

                    {/* Weight info */}
                    <div className="px-6 py-3 bg-gray-800/50 flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-4">
                        {weight ? (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-sm">⚖️ Weight on file:</span>
                            <span className="font-bold text-white">{weight} lbs</span>
                            <span className="text-gray-500 text-xs">
                              (entered by {booking.weight_entered_by ?? "driver"})
                            </span>
                          </div>
                        ) : (
                          <span className="text-amber-400 text-sm font-semibold">⚠️ Weight not yet entered</span>
                        )}
                      </div>

                      {/* Bag codes */}
                      <div className="flex gap-1.5 flex-wrap">
                        {inZone.map(bag => (
                          <span key={bag.id} className="text-xs font-mono bg-gray-700 text-gray-200 px-2.5 py-1 rounded-lg">
                            {bag.label_code ?? `B${bag.bag_number}`}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Mark ready */}
                    <div className="px-6 py-5">
                      <form action={markOrderReady}>
                        <input type="hidden" name="bookingId" value={booking.id} />
                        <input type="hidden" name="facilityCode" value={code} />
                        <button
                          type="submit"
                          className="w-full bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-extrabold text-xl py-5 rounded-2xl transition-colors"
                        >
                          ✅ Mark All Bags Ready for Pickup
                        </button>
                      </form>
                      <p className="text-center text-gray-600 text-xs mt-2">
                        Tap when washing, drying, and folding is complete
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Recently completed */}
        {done.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-600 mb-4 uppercase tracking-widest">
              ✓ Ready for Pickup ({done.length})
            </h2>
            <div className="space-y-2">
              {done.map((booking) => {
                const bags = booking.order_bags as Array<{ status: string }>
                const orderCode = booking.id.slice(0, 8).toUpperCase()
                const isDelivered = bags.every(b => b.status === "delivered")
                const isOutForDelivery = bags.some(b => b.status === "out_for_delivery")

                return (
                  <div key={booking.id} className="bg-gray-900/50 rounded-xl border border-gray-800 px-5 py-4 flex items-center justify-between gap-3">
                    <div>
                      <span className="font-bold text-gray-300">{booking.customer_name}</span>
                      <span className="text-gray-600 font-mono text-xs ml-3">{orderCode}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-500">
                        {bags.length} bag{bags.length === 1 ? "" : "s"}
                      </span>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        isDelivered
                          ? "bg-gray-700 text-gray-400"
                          : isOutForDelivery
                          ? "bg-blue-900 text-blue-300"
                          : "bg-green-900 text-green-400"
                      }`}>
                        {isDelivered ? "Delivered" : isOutForDelivery ? "En Route" : "Awaiting Pickup"}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* No orders at all */}
        {active.length === 0 && done.length === 0 && (
          <div className="text-center py-20">
            <p className="text-6xl mb-4">📭</p>
            <p className="text-gray-500 text-lg">No orders assigned to this facility yet.</p>
            <p className="text-gray-700 text-sm mt-2">Orders will appear here once the driver drops them off.</p>
          </div>
        )}
      </div>
    </div>
  )
}
