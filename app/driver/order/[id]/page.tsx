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
  pending: "Pending", picked_up: "Picked Up", at_facility: "At Facility",
  in_washer: "In Washer", in_dryer: "In Dryer", folded: "Folded",
  ready: "Ready", out_for_delivery: "Out for Delivery", delivered: "Delivered",
}
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-gray-100 text-gray-500", picked_up: "bg-blue-500 text-white",
  at_facility: "bg-purple-500 text-white", in_washer: "bg-cyan-500 text-white",
  in_dryer: "bg-orange-500 text-white", folded: "bg-yellow-500 text-white",
  ready: "bg-green-500 text-white", out_for_delivery: "bg-green-600 text-white",
  delivered: "bg-[#0D2240] text-white",
}
const ALL_STATUSES = ["pending","picked_up","at_facility","in_washer","in_dryer","folded","ready","out_for_delivery","delivered"]

// ── Batch: confirm pickup of all pending bags ─────────────────────────────────
async function confirmPickup(formData: FormData) {
  "use server"
  const bookingId = formData.get("bookingId") as string
  const driverName = (formData.get("driverName") as string) || "driver"
  const supabase = createAdminClient()
  await supabase.from("order_bags").update({ status: "picked_up" }).eq("booking_id", bookingId).eq("status", "pending")
  await supabase.from("order_events").insert({
    booking_id: bookingId, event_type: "pickup_confirmed",
    notes: "All bags picked up from customer", created_by: driverName,
  })
  await supabase.from("bookings").update({ status: "picked_up" }).eq("id", bookingId)
  revalidatePath(`/driver/order/${bookingId}`)
}

// ── Batch: drop-off at facility + weight entry ────────────────────────────────
async function confirmDropoff(formData: FormData) {
  "use server"
  const bookingId    = formData.get("bookingId") as string
  const facilityId   = formData.get("facilityId") as string
  const weightLbs    = parseFloat(formData.get("weightLbs") as string)
  const driverName   = (formData.get("driverName") as string) || "driver"
  if (!facilityId || isNaN(weightLbs) || weightLbs <= 0) return

  const supabase = createAdminClient()

  const facilityProcessingMode = (formData.get("facilityProcessingMode") as string) || "own_operator"

  // Get facility config for cost calculation
  const { data: facility } = await supabase
    .from("facilities")
    .select("rate_per_lb, minimum_lbs")
    .eq("id", facilityId)
    .single()

  // Look up booking to get locked-in rate
  const { data: bk } = await supabase
    .from("bookings")
    .select("price_per_lb_cents, service_type")
    .eq("id", bookingId)
    .single()

  const ratePerLbCents = bk?.price_per_lb_cents
    ?? DEFAULT_RATE_CENTS[bk?.service_type ?? "wash_fold"]
    ?? 250

  // Calculate billing
  const customerChargeLbs  = Math.max(weightLbs, CUSTOMER_MIN_LBS)
  const customerFinalCents = customerChargeLbs * ratePerLbCents

  let facilityCostCents: number | null = null
  if (facility?.rate_per_lb) {
    const facilityLbs = Math.max(weightLbs, facility.minimum_lbs ?? 0)
    facilityCostCents = Math.round(facilityLbs * facility.rate_per_lb * 100)
  }

  // Update booking
  await supabase.from("bookings").update({
    assigned_facility_id: facilityId,
    facility_processing_mode: facilityProcessingMode,
    actual_weight_lbs: weightLbs,
    customer_final_cents: customerFinalCents,
    facility_cost_cents: facilityCostCents,
    weight_entered_by: driverName,
    weight_entered_at: new Date().toISOString(),
    status: "at_facility",
  }).eq("id", bookingId)

  // Advance all picked_up bags to at_facility
  await supabase.from("order_bags").update({ status: "at_facility" })
    .eq("booking_id", bookingId).eq("status", "picked_up")

  // Event log
  await supabase.from("order_events").insert({
    booking_id: bookingId,
    facility_id: facilityId,
    event_type: "bags_received",
    notes: `Actual weight: ${weightLbs} lbs · Customer billed: ${customerChargeLbs} lbs ($${(customerFinalCents / 100).toFixed(2)})${facilityCostCents ? ` · Facility cost: $${(facilityCostCents / 100).toFixed(2)}` : ""}`,
    created_by: driverName,
  })

  // Trigger Stripe capture for wash-fold (pre-authorized)
  try {
    const { data: booking } = await supabase
      .from("bookings")
      .select("stripe_payment_intent_id, pre_auth_cents, service_type")
      .eq("id", bookingId)
      .single()

    if (booking?.service_type === "wash_fold" && booking.stripe_payment_intent_id && booking.pre_auth_cents) {
      await capturePayment(bookingId)
    }
  } catch (err) {
    console.error("[stripe] Capture failed after dropoff:", err)
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
  if (!bookingId || !photoUrl) return
  const supabase  = createAdminClient()
  await supabase.from("order_events").insert({
    booking_id: bookingId, event_type: "photo_pickup",
    photo_url: photoUrl, notes: "Pickup photo", created_by: "driver",
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
  const { data: facilities } = await supabase.from("facilities").select("id, name, address, supports_own_operator, supports_partner_attendant, rate_per_lb, minimum_lbs").eq("active", true).order("name")

  const orderCode    = booking.short_code ?? booking.id.slice(0, 6).toUpperCase()
  const allStatuses  = bags?.map(b => b.status) ?? []
  const allPending   = allStatuses.every(s => s === "pending")
  const allPickedUp  = allStatuses.every(s => s === "picked_up")
  const allAtFacility = allStatuses.every(s => ["at_facility","in_washer","in_dryer","folded"].includes(s))
  const allReady     = allStatuses.every(s => s === "ready")
  const allOutForDel = allStatuses.every(s => s === "out_for_delivery")
  const allDone      = allStatuses.every(s => s === "delivered")
  const somePickedUp = allStatuses.some(s => s === "picked_up")

  // Margin warning for dropoff
  const estimatedLbs  = booking.pounds ?? 0
  const facilityWarning = facilities?.filter(f =>
    f.rate_per_lb && (f.minimum_lbs ?? 0) > estimatedLbs
  ).map(f => f.name)

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

        {/* Order summary */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="grid grid-cols-4 gap-3 text-center text-sm">
            <div><p className="text-gray-400 text-xs">Service</p><p className="font-bold text-[#0D2240] text-xs">{booking.service_type === "wash_fold" ? "W&F" : "Comforter"}</p></div>
            <div><p className="text-gray-400 text-xs">Bags</p><p className="font-bold text-[#0D2240]">{bags?.length ?? 0}</p></div>
            <div><p className="text-gray-400 text-xs">Est. lbs</p><p className="font-bold text-[#0D2240]">{booking.pounds ?? "—"}</p></div>
            <div><p className="text-gray-400 text-xs">Actual lbs</p><p className={`font-bold ${booking.actual_weight_lbs ? "text-green-600" : "text-gray-300"}`}>{booking.actual_weight_lbs ?? "—"}</p></div>
          </div>
          {booking.actual_weight_lbs && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs">
              <span className="text-gray-400">Customer charge</span>
              <span className="font-bold text-[#0D2240]">${((booking.customer_final_cents ?? 0) / 100).toFixed(2)} ({Math.max(booking.actual_weight_lbs, CUSTOMER_MIN_LBS)} lbs)</span>
            </div>
          )}
        </div>

        {/* Interactive driver actions (pickup / dropoff / delivery) */}
        <DriverOrderClient
          bookingId={booking.id}
          bags={bags ?? []}
          facilities={facilities ?? []}
          estimatedLbs={estimatedLbs}
          facilityWarning={facilityWarning ?? []}
          allPending={allPending}
          allPickedUp={allPickedUp}
          somePickedUp={somePickedUp}
          allAtFacility={allAtFacility}
          allReady={allReady}
          allOutForDel={allOutForDel}
          allDone={allDone}
          deliveryDate={booking.delivery_date ?? null}
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
