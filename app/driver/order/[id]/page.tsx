import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import Link from "next/link"
import { revalidatePath } from "next/cache"
import LabelReference from "./label-reference"
import DriverOrderClient from "./order-client"
import { capturePayment } from "@/app/actions/stripe"

const CUSTOMER_MIN_LBS = 20
const DEFAULT_RATE_CENTS: Record<string, number> = {
  wash_fold:  250, // $2.50/lb one-time default
  wash_only:  199, // $1.99/lb
  comforter_wash: 0,
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending", picked_up: "Picked Up",
  at_warehouse: "At Warehouse",
  at_facility: "At Facility",
  in_washer: "In Washer", in_dryer: "In Dryer", folded: "Folded",
  ready: "Ready",
  ready_at_warehouse: "Ready at Warehouse",
  out_for_delivery: "Out for Delivery", delivered: "Delivered",
}
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-gray-100 text-gray-500", picked_up: "bg-blue-500 text-white",
  at_warehouse: "bg-amber-500 text-white",
  at_facility: "bg-purple-500 text-white", in_washer: "bg-cyan-500 text-white",
  in_dryer: "bg-orange-500 text-white", folded: "bg-yellow-500 text-white",
  ready: "bg-green-500 text-white",
  ready_at_warehouse: "bg-teal-500 text-white",
  out_for_delivery: "bg-green-600 text-white",
  delivered: "bg-[#0D2240] text-white",
}
const ALL_STATUSES = ["pending","picked_up","at_warehouse","at_facility","in_washer","in_dryer","folded","ready","ready_at_warehouse","out_for_delivery","delivered"]

// ── Batch: confirm pickup of all pending bags ─────────────────────────────────
async function confirmPickup(formData: FormData) {
  "use server"
  const bookingId      = formData.get("bookingId") as string
  const driverName     = (formData.get("driverName") as string) || "driver"
  const actualBagCount = parseInt(formData.get("actualBagCount") as string, 10)
  const supabase       = createAdminClient()

  // Fetch existing bags so we can reconcile the count
  const { data: existingBags } = await supabase
    .from("order_bags")
    .select("id, bag_number")
    .eq("booking_id", bookingId)
    .order("bag_number")

  const bookedCount = existingBags?.length ?? 0

  if (!isNaN(actualBagCount) && actualBagCount !== bookedCount) {
    if (actualBagCount > bookedCount) {
      // Driver found more bags than booked — insert extra rows
      const newBags = []
      for (let i = bookedCount + 1; i <= actualBagCount; i++) {
        const orderCode = bookingId.slice(0, 6).toUpperCase()
        newBags.push({
          booking_id:  bookingId,
          bag_number:  i,
          label_code:  `${orderCode}-B${i}`,
          status:      "pending",
        })
      }
      await supabase.from("order_bags").insert(newBags)
    } else {
      // Driver found fewer bags — delete extra rows from the end
      const toDelete = existingBags!.slice(actualBagCount).map(b => b.id)
      await supabase.from("order_bags").delete().in("id", toDelete)
    }
  }

  // Mark all pending bags as picked_up and update booking
  await supabase.from("order_bags").update({ status: "picked_up" }).eq("booking_id", bookingId).eq("status", "pending")

  const reconNote = !isNaN(actualBagCount) && actualBagCount !== bookedCount
    ? ` (booked ${bookedCount}, actual ${actualBagCount})`
    : ""

  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: "pickup_confirmed",
    notes:      `All bags picked up from customer${reconNote}`,
    created_by: driverName,
  })

  await supabase.from("bookings").update({
    status:   "picked_up",
    num_bags: isNaN(actualBagCount) ? bookedCount : actualBagCount,
  }).eq("id", bookingId)

  revalidatePath(`/driver/order/${bookingId}`)
}

// ── Batch: drop-off at WAREHOUSE + weight entry ───────────────────────────────
// Driver weighs and drops bags at the static warehouse.
// Facility assignment happens later when a transport run is executed.
async function confirmDropoff(formData: FormData) {
  "use server"
  const bookingId  = formData.get("bookingId") as string
  const weightLbs  = parseFloat(formData.get("weightLbs") as string)
  const driverName = (formData.get("driverName") as string) || "driver"
  if (isNaN(weightLbs) || weightLbs <= 0) return

  const supabase = createAdminClient()

  // Look up booking to get locked-in rate for customer billing
  const { data: bk } = await supabase
    .from("bookings")
    .select("price_per_lb_cents, service_type, stripe_payment_intent_id, pre_auth_cents")
    .eq("id", bookingId)
    .single()

  const ratePerLbCents = bk?.price_per_lb_cents
    ?? DEFAULT_RATE_CENTS[bk?.service_type ?? "wash_fold"]
    ?? 250

  // Calculate customer billing (facility cost calculated later when facility is assigned)
  const customerChargeLbs  = Math.max(weightLbs, CUSTOMER_MIN_LBS)
  const customerFinalCents = customerChargeLbs * ratePerLbCents

  // Update booking — status at_warehouse, weight + billing locked in
  await supabase.from("bookings").update({
    actual_weight_lbs:    weightLbs,
    customer_final_cents: customerFinalCents,
    weight_entered_by:    driverName,
    weight_entered_at:    new Date().toISOString(),
    status:               "at_warehouse",
    // Note: assigned_facility_id set later by transport run
  }).eq("id", bookingId)

  // Advance all picked_up bags to at_warehouse
  await supabase.from("order_bags").update({ status: "at_warehouse" })
    .eq("booking_id", bookingId).eq("status", "picked_up")

  // Event log
  await supabase.from("order_events").insert({
    booking_id:  bookingId,
    event_type:  "dropped_at_warehouse",
    notes:       `Weight: ${weightLbs} lbs · Customer billed: ${customerChargeLbs} lbs ($${(customerFinalCents / 100).toFixed(2)})`,
    created_by:  driverName,
  })

  // Trigger Stripe capture for wash-fold — we have the weight, capture now
  try {
    if (bk?.service_type === "wash_fold" && bk.stripe_payment_intent_id && bk.pre_auth_cents) {
      await capturePayment(bookingId)
    }
  } catch (err) {
    console.error("[stripe] Capture failed after warehouse dropoff:", err)
  }

  revalidatePath(`/driver/order/${bookingId}`)
}

// ── Batch: confirm delivery ───────────────────────────────────────────────────
async function confirmDelivery(formData: FormData) {
  "use server"
  const bookingId  = formData.get("bookingId") as string
  const driverName = (formData.get("driverName") as string) || "driver"
  const supabase   = createAdminClient()

  // Start delivery run — advance ready bags to out_for_delivery
  const nextStatus = formData.get("nextStatus") as string
  await supabase.from("order_bags").update({ status: nextStatus })
    .eq("booking_id", bookingId)
    .in("status", nextStatus === "out_for_delivery" ? ["ready"] : ["out_for_delivery"])

  const eventType = nextStatus === "out_for_delivery" ? "out_for_delivery" : "delivered"
  await supabase.from("order_events").insert({
    booking_id: bookingId, event_type: eventType,
    notes: nextStatus === "delivered" ? "All bags delivered to customer" : "Delivery run started",
    created_by: driverName,
  })

  if (nextStatus === "delivered") {
    await supabase.from("bookings").update({ status: "delivered" }).eq("id", bookingId)
  } else {
    await supabase.from("bookings").update({ status: "out_for_delivery" }).eq("id", bookingId)
  }

  revalidatePath(`/driver/order/${bookingId}`)
}

async function recordPhotoEvent(formData: FormData) {
  "use server"
  const bookingId = formData.get("bookingId") as string
  const photoUrl  = formData.get("photoUrl") as string
  const eventType = (formData.get("eventType") as string) || "photo_pickup"
  if (!bookingId || !photoUrl) return
  const NOTES: Record<string, string> = {
    photo_customer_pickup:  "Photo at customer — bags collected",
    photo_facility_dropoff: "Photo at facility — bags dropped off",
    photo_facility_pickup:  "Photo at facility — clean bags collected for delivery",
    photo_customer_delivery:"Photo at customer — bags delivered",
  }
  const supabase = createAdminClient()
  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: eventType,
    photo_url: photoUrl,
    notes: NOTES[eventType] ?? "Driver photo",
    created_by: "driver",
  })
  revalidatePath(`/driver/order/${bookingId}`)
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function DriverOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: booking } = await supabase.from("bookings").select("*").eq("id", id).single()
  if (!booking) notFound()

  const { data: bags } = await supabase.from("order_bags").select("*").eq("booking_id", id).order("bag_number")

  const orderCode         = booking.short_code ?? booking.id.slice(0, 6).toUpperCase()
  const allStatuses       = bags?.map(b => b.status) ?? []
  const allPending        = allStatuses.every(s => s === "pending")
  const allPickedUp       = allStatuses.every(s => s === "picked_up")
  const allAtWarehouse    = allStatuses.every(s => s === "at_warehouse")
  const allAtFacility     = allStatuses.every(s => ["at_facility","in_washer","in_dryer","folded"].includes(s))
  const allReady          = allStatuses.every(s => s === "ready")
  const allReadyAtWarehouse = allStatuses.every(s => s === "ready_at_warehouse")
  const allOutForDel      = allStatuses.every(s => s === "out_for_delivery")
  const allDone           = allStatuses.every(s => s === "delivered")
  const somePickedUp      = allStatuses.some(s => s === "picked_up")

  const estimatedLbs = booking.pounds ?? 0

  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      <div className="bg-[#0D2240] px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Link href="/driver" className="text-white/60 text-sm">← Route</Link>
          <div className="text-center">
            <p className="text-white font-extrabold font-mono text-lg">{orderCode}</p>
            <p className="text-white/50 text-xs">{booking.customer_name}</p>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${allDone ? "bg-green-500 text-white" : "bg-white/10 text-white/70"}`}>
            {allDone ? "Done ✓" : STATUS_LABEL[booking.status] ?? booking.status}
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Customer address */}
        <div className="bg-[#E8726A] rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl">📍</span>
          <div className="flex-1 min-w-0">
            <p className="text-white/70 text-xs font-bold uppercase tracking-wide">Customer Address</p>
            <p className="text-white font-extrabold text-base leading-tight">{booking.customer_address}</p>
          </div>
          <a href={`https://maps.google.com/?q=${encodeURIComponent(booking.customer_address)}`}
            target="_blank" rel="noreferrer"
            className="shrink-0 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors">
            Maps →
          </a>
        </div>

        {/* Label reference */}
        <LabelReference
          orderCode={orderCode}
          customerName={booking.customer_name}
          customerAddress={booking.customer_address ?? ""}
          bags={(bags ?? []).map(b => ({ id: b.id, bag_number: b.bag_number, label_code: b.label_code }))}
        />

        {/* Order at a glance */}
        {(() => {
          const isWashFold    = booking.service_type === "wash_fold"
          const isWashOnly    = booking.service_type === "wash_only"
          const isComforter   = booking.service_type === "comforter_wash"
          const bagCount      = bags?.length ?? 0
          const comforterCount= booking.num_comforters ?? bagCount
          const icon          = isComforter ? "🛏️" : isWashOnly ? "🫧" : "🧺"
          const serviceLabel  = isComforter ? "Comforter Wash" : isWashOnly ? "Wash Only" : "Wash & Fold"
          const countLabel    = isComforter
            ? `${comforterCount} comforter${comforterCount !== 1 ? "s" : ""}${booking.comforter_size ? ` · ${booking.comforter_size}` : ""}`
            : `${bagCount} bag${bagCount !== 1 ? "s" : ""}`
          const weightLabel   = booking.pounds ? `~${booking.pounds} lbs estimated` : null

          return (
            <div className="bg-[#0D2240] rounded-2xl px-5 py-4 flex items-center gap-4">
              <span className="text-3xl">{icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white font-extrabold text-lg leading-tight">{serviceLabel}</p>
                <p className="text-[#E8726A] font-bold text-base">{countLabel}</p>
                {weightLabel && <p className="text-white/50 text-xs mt-0.5">{weightLabel}</p>}
              </div>
              {booking.actual_weight_lbs && (
                <div className="text-right shrink-0">
                  <p className="text-white/50 text-[10px] uppercase tracking-wide">Actual</p>
                  <p className="text-green-400 font-extrabold text-lg">{booking.actual_weight_lbs} lbs</p>
                </div>
              )}
            </div>
          )
        })()}

        {/* Order summary */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="grid grid-cols-4 gap-3 text-center text-sm">
            <div><p className="text-gray-500 text-xs">Service</p><p className="font-bold text-[#0D2240] text-xs">{booking.service_type === "wash_fold" ? "W&F" : booking.service_type === "wash_only" ? "Wash Only" : "Comforter"}</p></div>
            <div><p className="text-gray-500 text-xs">Bags</p><p className="font-bold text-[#0D2240]">{bags?.length ?? 0}</p></div>
            <div><p className="text-gray-500 text-xs">Est. lbs</p><p className="font-bold text-[#0D2240]">{booking.pounds ?? "—"}</p></div>
            <div><p className="text-gray-500 text-xs">Actual lbs</p><p className={`font-bold ${booking.actual_weight_lbs ? "text-green-600" : "text-gray-300"}`}>{booking.actual_weight_lbs ?? "—"}</p></div>
          </div>
          {booking.actual_weight_lbs && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs">
              <span className="text-gray-500">Customer charge</span>
              <span className="font-bold text-[#0D2240]">${((booking.customer_final_cents ?? 0) / 100).toFixed(2)} ({Math.max(booking.actual_weight_lbs, CUSTOMER_MIN_LBS)} lbs)</span>
            </div>
          )}
        </div>

        {/* ── Facility specs — shown when order is finished and ready for pickup ── */}
        {(booking.color_key || booking.facility_floor_photo_url || booking.folded_bag_count || booking.hold_at_facility != null) &&
         ["ready","staged","ready_at_warehouse","out_for_delivery"].some(s => booking.status === s || (bags ?? []).some(b => b.status === s)) && (() => {
          const COLOR_HEX: Record<string, string> = {
            red:"#ef4444", blue:"#3b82f6", sky:"#38bdf8", green:"#22c55e",
            lime:"#84cc16", pink:"#f472b6", hotpink:"#ec4899",
            orange:"#f97316", yellow:"#eab308", purple:"#a855f7",
          }
          const COLOR_LABEL: Record<string, string> = {
            red:"Red", blue:"Blue", sky:"Sky Blue", green:"Green",
            lime:"Lime", pink:"Pink", hotpink:"Hot Pink",
            orange:"Orange", yellow:"Yellow", purple:"Purple",
          }
          const hex = booking.color_key ? (COLOR_HEX[booking.color_key] ?? "#d1d5db") : null
          const foldedCount = booking.folded_bag_count ?? bags?.length ?? 0
          const pickedUpCount = bags?.length ?? 0
          return (
            <div className="rounded-2xl overflow-hidden border-2 border-[#0D2240] shadow-sm">
              <div className="bg-[#0D2240] px-4 py-3 flex items-center gap-2">
                <span className="text-xl">🏭</span>
                <div>
                  <p className="text-white font-extrabold text-sm uppercase tracking-wide">Facility Specs</p>
                  <p className="text-white/60 text-xs">Set by the washing operator — use to locate this order</p>
                </div>
              </div>
              <div className="bg-white p-4 space-y-4">

                {/* Location */}
                <div className={`rounded-xl px-4 py-3 flex items-center gap-3 ${booking.hold_at_facility ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
                  <span className="text-2xl">{booking.hold_at_facility ? "📍" : "📦"}</span>
                  <div>
                    <p className={`font-extrabold text-sm ${booking.hold_at_facility ? "text-emerald-700" : "text-amber-700"}`}>
                      {booking.hold_at_facility ? "On facility floor" : "At remote storage"}
                    </p>
                    <p className={`text-xs mt-0.5 ${booking.hold_at_facility ? "text-emerald-600" : "text-amber-600"}`}>
                      {booking.hold_at_facility
                        ? "Look for this order in the floor temp area — color key sticker only."
                        : "Pick up from remote storage — look for color key sticker + second marker sticker."}
                    </p>
                  </div>
                </div>

                {/* Color key sticker */}
                {hex && (
                  <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                    <span className="w-8 h-8 rounded-full shrink-0 shadow-md ring-2 ring-white" style={{ background: hex }} />
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Color Key Sticker</p>
                      <p className="text-[#0D2240] font-extrabold text-base">{COLOR_LABEL[booking.color_key!]}</p>
                    </div>
                  </div>
                )}

                {/* Bag count */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Picked Up</p>
                    <p className="text-[#0D2240] font-extrabold text-xl">{pickedUpCount}</p>
                    <p className="text-gray-400 text-[10px]">bags</p>
                  </div>
                  <div className={`rounded-xl px-3 py-2.5 border text-center ${foldedCount !== pickedUpCount ? "bg-purple-50 border-purple-200" : "bg-gray-50 border-gray-100"}`}>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Folded</p>
                    <p className={`font-extrabold text-xl ${foldedCount !== pickedUpCount ? "text-purple-600" : "text-[#0D2240]"}`}>{foldedCount}</p>
                    <p className="text-gray-400 text-[10px]">bags{foldedCount !== pickedUpCount ? " ← use this count" : ""}</p>
                  </div>
                </div>
                {foldedCount !== pickedUpCount && (
                  <p className="text-xs text-purple-600 font-semibold bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                    ⚠️ Folded count differs from pickup — deliver <strong>{foldedCount} bag{foldedCount !== 1 ? "s" : ""}</strong> to the customer.
                  </p>
                )}

                {/* Placement photo */}
                {booking.facility_floor_photo_url && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Placement Photo</p>
                    <img
                      src={booking.facility_floor_photo_url}
                      alt="Facility placement"
                      className="w-full rounded-xl border border-gray-200 object-cover max-h-56 shadow-sm"
                    />
                    <p className="text-xs text-gray-500 text-center">Use this photo to locate the order</p>
                  </div>
                )}
                {!booking.facility_floor_photo_url && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    ⚠️ No placement photo yet — ask the operator before heading out.
                  </p>
                )}

              </div>
            </div>
          )
        })()}

        {/* Interactive driver actions (pickup / dropoff / delivery) */}
        <DriverOrderClient
          bookingId={booking.id}
          bags={bags ?? []}
          estimatedLbs={estimatedLbs}
          allPending={allPending}
          allPickedUp={allPickedUp}
          somePickedUp={somePickedUp}
          allAtWarehouse={allAtWarehouse}
          allAtFacility={allAtFacility}
          allReady={allReady}
          allReadyAtWarehouse={allReadyAtWarehouse}
          allOutForDel={allOutForDel}
          allDone={allDone}
          pickupDate={booking.pickup_date ?? null}
          deliveryDate={booking.delivery_date ?? null}
          assignedFacilityName={(booking.assigned_facility as { name?: string } | null)?.name ?? null}
          confirmPickup={confirmPickup}
          confirmDropoff={confirmDropoff}
          confirmDelivery={confirmDelivery}
          recordPhotoEvent={recordPhotoEvent}
        />

        {/* Bag status grid */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Bag Status</p>
          <div className="grid grid-cols-2 gap-2">
            {bags?.map((bag) => {
              const idx = ALL_STATUSES.indexOf(bag.status)
              return (
                <div key={bag.id} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#0D2240] font-mono text-sm">B{bag.bag_number}</span>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${STATUS_COLOR[bag.status] ?? "bg-gray-100 text-gray-400"}`}>
                      {STATUS_LABEL[bag.status] ?? bag.status}
                    </span>
                  </div>
                  <div className="flex gap-0.5">
                    {ALL_STATUSES.map((_, i) => (
                      <div key={i} className={`flex-1 h-1 rounded-full ${i <= idx ? "bg-[#E8726A]" : "bg-gray-100"}`} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
