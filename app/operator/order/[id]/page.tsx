import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import Link from "next/link"
import { revalidatePath } from "next/cache"
import PhotoUploader from "./photo-uploader"

const BAG_STATUS_FLOW = ["pending", "picked_up", "at_facility", "in_washer", "in_dryer", "folded", "ready", "delivered"]

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  picked_up: "Picked Up",
  at_facility: "At Facility",
  in_washer: "In Washer",
  in_dryer: "In Dryer",
  folded: "Folded",
  ready: "Ready",
  delivered: "Delivered",
}

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-gray-100 text-gray-500",
  picked_up: "bg-blue-500 text-white",
  at_facility: "bg-purple-500 text-white",
  in_washer: "bg-cyan-500 text-white",
  in_dryer: "bg-orange-500 text-white",
  folded: "bg-yellow-500 text-white",
  ready: "bg-green-500 text-white",
  delivered: "bg-[#0D2240] text-white",
}

async function recordPhotoEvent(formData: FormData) {
  "use server"
  const bookingId = formData.get("bookingId") as string
  const photoUrl = formData.get("photoUrl") as string
  if (!bookingId || !photoUrl) return
  const supabase = createAdminClient()
  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: "photo_pickup",
    photo_url: photoUrl,
    notes: "Pickup photo",
    created_by: "driver",
  })
  revalidatePath(`/operator/order/${bookingId}`)
}

async function advanceBag(formData: FormData) {
  "use server"
  const bagId = formData.get("bagId") as string
  const bookingId = formData.get("bookingId") as string
  const currentStatus = formData.get("currentStatus") as string
  const machineId = formData.get("machineId") as string || null
  const operatorName = formData.get("operatorName") as string || "operator"

  const currentIdx = BAG_STATUS_FLOW.indexOf(currentStatus)
  if (currentIdx < 0 || currentIdx >= BAG_STATUS_FLOW.length - 1) return

  const nextStatus = BAG_STATUS_FLOW[currentIdx + 1]
  const supabase = createAdminClient()

  await supabase.from("order_bags").update({ status: nextStatus }).eq("id", bagId)

  const eventTypeMap: Record<string, string> = {
    picked_up: "pickup_confirmed",
    at_facility: "bags_received",
    in_washer: "bag_in_washer",
    in_dryer: "bag_in_dryer",
    folded: "bag_folded",
    ready: "ready_for_delivery",
    delivered: "delivered",
  }

  await supabase.from("order_events").insert({
    booking_id: bookingId,
    bag_id: bagId,
    machine_id: machineId || null,
    event_type: eventTypeMap[nextStatus] ?? nextStatus,
    notes: machineId ? `Machine assigned` : null,
    created_by: operatorName,
  })

  revalidatePath(`/operator/order/${bookingId}`)
}

export default async function OperatorOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: booking } = await supabase.from("bookings").select("*").eq("id", id).single()
  if (!booking) notFound()

  const { data: bags } = await supabase
    .from("order_bags")
    .select("*")
    .eq("booking_id", id)
    .order("bag_number")

  const { data: facilities } = await supabase
    .from("facilities")
    .select("id, name, machine_groups(id, name, type, machines(id, name, status))")
    .eq("active", true)
    .order("name")

  const orderCode = booking.id.slice(0, 8).toUpperCase()

  // Determine overall progress
  const allStatuses = bags?.map(b => b.status) ?? []
  const allDone = allStatuses.every(s => s === "delivered")
  const allReady = allStatuses.every(s => s === "ready" || s === "delivered")

  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      {/* Mobile header */}
      <div className="bg-[#0D2240] px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Link href="/operator" className="text-white/60 text-sm">← Back</Link>
          <div className="text-center">
            <p className="text-white font-extrabold font-mono text-lg">{orderCode}</p>
            <p className="text-white/50 text-xs">{booking.customer_name}</p>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            allDone ? "bg-green-500 text-white" : "bg-white/10 text-white/70"
          }`}>
            {allDone ? "Done ✓" : `${allStatuses.filter(s => s !== "pending").length}/${bags?.length ?? 0}`}
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Order summary strip */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <p className="text-gray-400 text-xs">Service</p>
              <p className="font-bold text-[#0D2240]">{booking.service_type === "wash_fold" ? "W&F" : "Comforter"}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Bags</p>
              <p className="font-bold text-[#0D2240]">{bags?.length ?? 0}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Pickup</p>
              <p className="font-bold text-[#0D2240]">{booking.pickup_date}</p>
            </div>
          </div>
        </div>

        {/* Photo capture */}
        <PhotoUploader bookingId={booking.id} action={recordPhotoEvent} />

        {/* Bags */}
        {bags?.map((bag) => {
          const currentIdx = BAG_STATUS_FLOW.indexOf(bag.status)
          const nextStatus = BAG_STATUS_FLOW[currentIdx + 1]
          const isDone = bag.status === "delivered"
          const needsMachine = nextStatus === "in_washer" || nextStatus === "in_dryer"

          return (
            <div key={bag.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Bag header */}
              <div className="flex items-center gap-3 p-4 border-b border-gray-50">
                <div className="w-12 h-12 rounded-xl bg-[#0D2240] flex items-center justify-center shrink-0">
                  <span className="text-white font-extrabold text-lg font-mono">B{bag.bag_number}</span>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-[#0D2240] font-mono">{bag.label_code}</p>
                  <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mt-0.5 ${STATUS_COLOR[bag.status]}`}>
                    {STATUS_LABEL[bag.status]}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="px-4 py-2">
                <div className="flex gap-1">
                  {BAG_STATUS_FLOW.map((s, i) => (
                    <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${
                      i <= currentIdx ? "bg-[#E8726A]" : "bg-gray-100"
                    }`} />
                  ))}
                </div>
              </div>

              {/* Action */}
              {!isDone && nextStatus && (
                <div className="p-4 pt-2">
                  <form action={advanceBag} className="space-y-3">
                    <input type="hidden" name="bagId" value={bag.id} />
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <input type="hidden" name="currentStatus" value={bag.status} />

                    {needsMachine && (
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                          {nextStatus === "in_washer" ? "Select Washer" : "Select Dryer"}
                        </label>
                        <select name="machineId" required
                          className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:border-[#E8726A]">
                          <option value="">— choose machine —</option>
                          {facilities?.map((facility) => {
                            const machineType = nextStatus === "in_washer" ? "washer" : "dryer"
                            const groups = (facility.machine_groups as Array<{
                              id: string
                              name: string
                              type: string
                              machines: Array<{ id: string; name: string; status: string }>
                            }>)?.filter(g => g.type === machineType) ?? []
                            if (groups.every(g => g.machines?.length === 0)) return null
                            return (
                              <optgroup key={facility.id} label={facility.name}>
                                {groups.flatMap(g =>
                                  g.machines
                                    ?.filter((m) => m.status === "active")
                                    .map((m) => (
                                      <option key={m.id} value={m.id}>
                                        {m.name} — {g.name}
                                      </option>
                                    )) ?? []
                                )}
                              </optgroup>
                            )
                          })}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Your Name</label>
                      <input name="operatorName" type="text" placeholder="Your name"
                        className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:border-[#E8726A]" />
                    </div>

                    <button type="submit"
                      className="w-full bg-[#E8726A] hover:bg-[#d45f57] text-white font-extrabold py-4 rounded-2xl text-base transition-colors">
                      → Mark as: {STATUS_LABEL[nextStatus]}
                    </button>
                  </form>
                </div>
              )}
              {isDone && (
                <div className="p-4 text-center text-green-600 font-bold text-sm">✓ Completed</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
