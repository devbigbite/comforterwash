import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import Link from "next/link"
import { revalidatePath } from "next/cache"
import LabelReference from "./label-reference"
import DriverOrderClient from "./order-client"
import { capturePayment, chargeCommercialAccountOrder } from "@/app/actions/stripe"
import { updateBookingStatus } from "@/app/actions/bookings"
import { sendBookingNotification } from "@/lib/sms"
import { sendWeightConfirmedEmail } from "@/lib/email"
import { syncPhaseFromStatus } from "@/lib/order-status-sync"
import { calculateOrderBilling } from "@/lib/order-billing"

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

// ── Notify customer the driver is on the way for pickup ──────────────────────
// Fired BEFORE the driver arrives (not after collecting bags), so the
// customer has a chance to actually put the laundry out. Just an SMS + an
// audit event — it does not touch order_bags/booking status.
async function notifyPickupEnroute(formData: FormData) {
  "use server"
  const bookingId  = formData.get("bookingId") as string
  const driverName = (formData.get("driverName") as string) || "driver"
  const supabase   = createAdminClient()

  const { data: booking } = await supabase
    .from("bookings")
    .select("customer_name, pickup_time_window")
    .eq("id", bookingId)
    .single()

  if (booking) {
    try {
      const firstName = booking.customer_name?.split(" ")[0] ?? "there"
      await sendBookingNotification(bookingId, "pickup_reminder", firstName, booking.pickup_time_window ?? "your scheduled time")
    } catch (err) {
      console.error("[driver] Enroute pickup SMS failed:", err)
    }
  }

  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: "driver_enroute_pickup",
    notes:      "Driver marked en route — customer notified to leave laundry out",
    created_by: driverName,
  })

  revalidatePath(`/driver/order/${bookingId}`)
}

// ── Batch: confirm pickup of all pending bags ─────────────────────────────────
async function confirmPickup(formData: FormData) {
  "use server"
  const bookingId      = formData.get("bookingId") as string
  const driverName     = (formData.get("driverName") as string) || "driver"
  const actualBagCount = parseInt(formData.get("actualBagCount") as string, 10)
  const colorKey       = (formData.get("colorKey") as string) || null
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
    num_bags:  isNaN(actualBagCount) ? bookedCount : actualBagCount,
    ...(colorKey ? { color_key: colorKey } : {}),
  }).eq("id", bookingId)

  // Sets status to "picked_up" and fires the "we've got your laundry" SMS.
  await updateBookingStatus(bookingId, "picked_up")

  revalidatePath(`/driver/order/${bookingId}`)
}

// ── Batch: drop-off at WAREHOUSE or FACILITY + weight entry ──────────────────
async function confirmDropoff(formData: FormData) {
  "use server"
  const bookingId       = formData.get("bookingId") as string
  const weightLbs       = parseFloat(formData.get("weightLbs") as string)
  const driverName      = (formData.get("driverName") as string) || "driver"
  // Facility, not warehouse, is the default drop-off — warehouse is only the
  // right call for home-based operators routing through a transport run to a
  // partner laundromat (see getDriverQueue callers / the page-level default
  // below). Falling back to warehouse here silently mis-routed nearly every
  // pickup for facility-mode tenants, since most bookings never had
  // assigned_facility_id pre-set at pickup time.
  const dropoffLocation = (formData.get("dropoffLocation") as string) || "facility"
  const floorPhotoUrl   = (formData.get("floorPhotoUrl") as string) || null
  if (isNaN(weightLbs) || weightLbs <= 0) return

  const supabase = createAdminClient()

  // Look up booking to get locked-in rate for customer billing
  const { data: bk } = await supabase
    .from("bookings")
    .select("price_per_lb_cents, service_type, stripe_payment_intent_id, pre_auth_cents, assigned_facility_id, location_id, short_code, customer_name, customer_email, customer_phone, commercial_account_id, wash_fold_bag_selection, wash_only_bag_selection")
    .eq("id", bookingId)
    .single()

  // Auto-assign the tenant's own facility if this booking isn't pointed at
  // one yet — for a facility-mode tenant with exactly one facility (the
  // overwhelmingly common case), there's no ambiguity to ask the driver
  // about, and downstream facility-cost billing needs assigned_facility_id
  // set as soon as possible rather than waiting on a separate admin step.
  let assignedFacilityId = bk?.assigned_facility_id ?? null
  if (dropoffLocation === "facility" && !assignedFacilityId && bk?.location_id) {
    const { data: facilities } = await supabase
      .from("facilities")
      .select("id")
      .eq("location_id", bk.location_id)
    if (facilities?.length === 1) assignedFacilityId = facilities[0].id
  }

  // Both money figures are computed here, by the same helper the admin and
  // operator weigh-in paths use (lib/order-billing.ts). This used to be a
  // local copy of the consumer per-lb math that (a) ignored commercial
  // account rates entirely and (b) never computed facility cost at all,
  // leaving facility_cost_cents NULL — which is what made the admin order
  // page insist "weight not yet entered" on an already-weighed order.
  // assignedFacilityId (resolved just above) is passed rather than
  // bk.assigned_facility_id so a facility auto-assigned on this very
  // drop-off is still costed now, not silently deferred to "later".
  const { customerFinalCents, facilityCostCents, isCommercial, basis } = await calculateOrderBilling(
    supabase,
    {
      service_type:          bk?.service_type ?? null,
      price_per_lb_cents:    bk?.price_per_lb_cents ?? null,
      commercial_account_id: bk?.commercial_account_id ?? null,
      assigned_facility_id:  assignedFacilityId,
      wash_fold_bag_selection: bk?.wash_fold_bag_selection ?? null,
      wash_only_bag_selection: bk?.wash_only_bag_selection ?? null,
    },
    weightLbs,
  )

  const newStatus     = dropoffLocation === "facility" ? "at_facility" : "at_warehouse"
  const eventType     = dropoffLocation === "facility" ? "dropped_at_facility" : "dropped_at_warehouse"
  const locationLabel = dropoffLocation === "facility" ? "facility" : "warehouse"

  const { error: dropoffUpdateError } = await supabase.from("bookings").update({
    actual_weight_lbs:      weightLbs,
    customer_final_cents:   customerFinalCents,
    facility_cost_cents:    facilityCostCents,
    weight_entered_by:      driverName,
    weight_entered_at:      new Date().toISOString(),
    status:                 newStatus,
    ...(assignedFacilityId ? { assigned_facility_id: assignedFacilityId } : {}),
    ...(floorPhotoUrl ? { facility_floor_photo_url: floorPhotoUrl } : {}),
  }).eq("id", bookingId)

  // This update was previously unchecked — if it failed, the driver still
  // saw a "Dropped at facility" success screen and the timeline still logged
  // a "Weight: ... lbs · Customer billed: ..." event (that note is built from
  // this function's local variables, not read back from the row), so nothing
  // looked wrong until someone opened the admin order page later and found
  // actual_weight_lbs/customer_final_cents still null despite the timeline
  // showing a weight. Logging the failure loudly instead of swallowing it.
  if (dropoffUpdateError) {
    console.error("[driver] confirmDropoff booking update failed:", dropoffUpdateError.message)
    await supabase.from("order_events").insert({
      booking_id: bookingId,
      event_type: "weight_confirmed",
      notes: `⚠ Weight/billing save FAILED: ${dropoffUpdateError.message} — weight was ${weightLbs} lbs, re-enter from the admin order page`,
      created_by: driverName,
    })
  }

  await supabase.from("order_bags").update({ status: newStatus })
    .eq("booking_id", bookingId).eq("status", "picked_up")

  await syncPhaseFromStatus(supabase, bookingId, newStatus)

  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: eventType,
    notes:      `Weight: ${weightLbs} lbs · Customer billed $${(customerFinalCents / 100).toFixed(2)} (${basis}) · Facility cost $${(facilityCostCents / 100).toFixed(2)} · Dropped at ${locationLabel}`,
    created_by: driverName,
  })

  // Internal-only floor photo (excluded from customer-visible events)
  if (floorPhotoUrl) {
    await supabase.from("order_events").insert({
      booking_id: bookingId,
      event_type: "photo_facility_dropoff",
      photo_url:  floorPhotoUrl,
      notes:      `[Internal] Bags placed at ${locationLabel} — location photo`,
      created_by: driverName,
    })
  }

  // Dispatch the actual charge. Commercial pay-at-service accounts have no
  // pre-auth to capture — they're charged off-session against the card on
  // file — so the old capture-only branch silently skipped them and left
  // payment_status stuck at "pending_weight" through delivery. Mirrors the
  // dispatch logic in app/actions/weigh-in.ts.
  if (isCommercial && customerFinalCents) {
    try {
      const result = await chargeCommercialAccountOrder(bookingId)
      if (result.error) {
        await supabase.from("order_events").insert({
          booking_id: bookingId,
          event_type: "commercial_charge_failed",
          notes: `Charge failed: ${result.error}`,
          created_by: "system",
        })
      }
    } catch (err) {
      console.error("[stripe] Commercial charge failed after dropoff:", err)
    }
  } else {
    try {
      if (bk?.service_type === "wash_fold" && bk.stripe_payment_intent_id && bk.pre_auth_cents) {
        await capturePayment(bookingId)
      }
    } catch (err) {
      console.error("[stripe] Capture failed after dropoff:", err)
    }
  }

  // Tell the customer their order was weighed — same notification as the
  // admin/operator weigh-in path (app/actions/weigh-in.ts). Deliberately no
  // pricing per explicit request — just a warm thank-you + the weight.
  // Skipped entirely if the earlier booking-update failed, since
  // customer_final_cents/actual_weight_lbs wouldn't actually be saved yet.
  if (!dropoffUpdateError) {
    try {
      if (bk?.customer_phone) {
        await sendBookingNotification(bookingId, "weight_confirmed",
          bk.customer_name?.split(" ")[0] ?? "there", String(weightLbs))
      }
      if (bk?.customer_email) {
        await sendWeightConfirmedEmail(bk.customer_email, {
          customerName: bk.customer_name ?? "Valued Customer",
          shortCode: bk.short_code ?? null,
          weightLbs,
        })
      }
    } catch (e) { console.error("[driver] Weight-confirmed notification failed:", e) }
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

  // Sets the booking status and fires the matching customer SMS
  // ("out for delivery" when the driver starts the run, "delivered" once confirmed).
  await updateBookingStatus(bookingId, nextStatus === "delivered" ? "delivered" : "out_for_delivery")

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

  // Facility is the default drop-off for every tenant, home-based or not.
  // For a home operator, "their facility" is almost always just their own
  // home setup — the "Warehouse"/"transport run" path only makes sense once
  // they've actually added a partner laundromat (see app/actions/laundromats.ts
  // and the home-board's "Needs laundromat" toggle), which is the deliberate
  // exception, not the default. If there's exactly one facility on file for
  // this tenant (the overwhelmingly common case either way), auto-assign it
  // below in confirmDropoff so there's no ambiguity to ask the driver about.
  const defaultDropoffLocation: "warehouse" | "facility" = "facility"

  const { data: bags } = await supabase.from("order_bags").select("*").eq("booking_id", id).order("bag_number")

  const { data: enrouteEvent } = await supabase
    .from("order_events")
    .select("id")
    .eq("booking_id", id)
    .eq("event_type", "driver_enroute_pickup")
    .limit(1)
    .maybeSingle()
  const enrouteAlreadySent = !!enrouteEvent

  // Colors already claimed by other orders on the same pickup date
  const { data: sameDay } = await supabase
    .from("bookings")
    .select("color_key")
    .eq("pickup_date", booking.pickup_date)
    .neq("id", id)
    .not("color_key", "is", null)
  const takenColors = (sameDay ?? []).map(b => b.color_key as string).filter(Boolean)

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
          <Link href="/driver" className="text-white/60 text-base">← Route</Link>
          <div className="text-center">
            <p className="text-white font-extrabold font-mono text-xl">{orderCode}</p>
            <p className="text-white/50 text-sm">{booking.customer_name}</p>
          </div>
          <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${allDone ? "bg-green-500 text-white" : "bg-white/10 text-white/70"}`}>
            {allDone ? "Done ✓" : STATUS_LABEL[booking.status] ?? booking.status}
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Customer address + direct call — Shipday no longer has this
            customer's contact info (see lib/shipday.ts — blanked out
            deliberately to stop Shipday's own duplicate SMS), so this is now
            the only in-app way to reach a customer directly if bags aren't
            out / no one answers the door. Uses a plain tel: link, which
            dials through the driver's own phone — no extra service needed. */}
        <div className="bg-[#E8726A] rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📍</span>
            <div className="flex-1 min-w-0">
              <p className="text-white/70 text-sm font-bold uppercase tracking-wide">Customer Address</p>
              <p className="text-white font-extrabold text-lg leading-tight">{booking.customer_address}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {booking.customer_phone && (
              <a href={`tel:${booking.customer_phone}`}
                className="flex-1 text-center bg-white/20 hover:bg-white/30 text-white text-sm font-bold px-3 py-2 rounded-xl transition-colors">
                📞 Call
              </a>
            )}
            {booking.customer_phone && (
              <a href={`sms:${booking.customer_phone}`}
                className="flex-1 text-center bg-white/20 hover:bg-white/30 text-white text-sm font-bold px-3 py-2 rounded-xl transition-colors">
                💬 Text
              </a>
            )}
            <a href={`https://maps.google.com/?q=${encodeURIComponent(booking.customer_address)}`}
              target="_blank" rel="noreferrer"
              className="flex-1 text-center bg-white/20 hover:bg-white/30 text-white text-sm font-bold px-3 py-2 rounded-xl transition-colors">
              Maps →
            </a>
          </div>
        </div>

        {/* Label reference */}
        <LabelReference
          orderCode={orderCode}
          customerName={booking.customer_name}
          customerAddress={booking.customer_address ?? ""}
          bags={(bags ?? []).map(b => ({ id: b.id, bag_number: b.bag_number, label_code: b.label_code }))}
          colorKey={booking.color_key ?? null}
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
                <p className="text-white font-extrabold text-xl leading-tight">{serviceLabel}</p>
                <p className="text-[#E8726A] font-bold text-lg">{countLabel}</p>
                {weightLabel && <p className="text-white/50 text-sm mt-0.5">{weightLabel}</p>}
              </div>
              {booking.actual_weight_lbs && (
                <div className="text-right shrink-0">
                  <p className="text-white/50 text-[10px] uppercase tracking-wide">Actual</p>
                  <p className="text-green-400 font-extrabold text-xl">{booking.actual_weight_lbs} lbs</p>
                </div>
              )}
            </div>
          )
        })()}

        {/* Order summary */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          {booking.service_type === "comforter_wash" ? (
            <div className="grid grid-cols-2 gap-3 text-center text-base">
              <div><p className="text-gray-500 text-sm">Service</p><p className="font-bold text-[#0D2240] text-sm">Comforter</p></div>
              <div><p className="text-gray-500 text-sm">Comforters</p><p className="font-bold text-[#0D2240]">{booking.num_comforters ?? bags?.length ?? 0}</p></div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3 text-center text-base">
                <div><p className="text-gray-500 text-sm">Service</p><p className="font-bold text-[#0D2240] text-sm">{booking.service_type === "wash_fold" ? "W&F" : "Wash Only"}</p></div>
                <div><p className="text-gray-500 text-sm">Bags</p><p className="font-bold text-[#0D2240]">{bags?.length ?? 0}</p></div>
                <div><p className="text-gray-500 text-sm">Est. lbs</p><p className="font-bold text-[#0D2240]">{booking.pounds ?? "—"}</p></div>
                <div><p className="text-gray-500 text-sm">Actual lbs</p><p className={`font-bold ${booking.actual_weight_lbs ? "text-green-600" : "text-gray-300"}`}>{booking.actual_weight_lbs ?? "—"}</p></div>
              </div>
            </>
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
                <span className="text-2xl">🏭</span>
                <div>
                  <p className="text-white font-extrabold text-base uppercase tracking-wide">Facility Specs</p>
                  <p className="text-white/60 text-sm">Set by the washing operator — use to locate this order</p>
                </div>
              </div>
              <div className="bg-white p-4 space-y-4">

                {/* Location */}
                <div className={`rounded-xl px-4 py-3 flex items-center gap-3 ${booking.hold_at_facility ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
                  <span className="text-2xl">{booking.hold_at_facility ? "📍" : "📦"}</span>
                  <div>
                    <p className={`font-extrabold text-base ${booking.hold_at_facility ? "text-emerald-700" : "text-amber-700"}`}>
                      {booking.hold_at_facility ? "On facility floor" : "At remote storage"}
                    </p>
                    <p className={`text-sm mt-0.5 ${booking.hold_at_facility ? "text-emerald-600" : "text-amber-600"}`}>
                      {booking.hold_at_facility
                        ? "Look for this order in the floor temp area — color key sticker."
                        : "Pick up from remote storage — look for the color key sticker."}
                    </p>
                  </div>
                </div>

                {/* Color key sticker */}
                {hex && (
                  <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                    <span className="w-8 h-8 rounded-full shrink-0 shadow-md ring-2 ring-white" style={{ background: hex }} />
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Color Key Sticker</p>
                      <p className="text-[#0D2240] font-extrabold text-lg">{COLOR_LABEL[booking.color_key!]}</p>
                    </div>
                  </div>
                )}

                {/* Bag count */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Picked Up</p>
                    <p className="text-[#0D2240] font-extrabold text-2xl">{pickedUpCount}</p>
                    <p className="text-gray-400 text-[10px]">bags</p>
                  </div>
                  <div className={`rounded-xl px-3 py-2.5 border text-center ${foldedCount !== pickedUpCount ? "bg-purple-50 border-purple-200" : "bg-gray-50 border-gray-100"}`}>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{booking.service_type === "comforter_wash" ? "Washed" : "Folded"}</p>
                    <p className={`font-extrabold text-2xl ${foldedCount !== pickedUpCount ? "text-purple-600" : "text-[#0D2240]"}`}>{foldedCount}</p>
                    <p className="text-gray-400 text-[10px]">bags{foldedCount !== pickedUpCount ? " ← use this count" : ""}</p>
                  </div>
                </div>
                {foldedCount !== pickedUpCount && (
                  <p className="text-sm text-purple-600 font-semibold bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                    ⚠️ Folded count differs from pickup — deliver <strong>{foldedCount} bag{foldedCount !== 1 ? "s" : ""}</strong> to the customer.
                  </p>
                )}

                {/* Finished product & facility location photo */}
                {booking.facility_floor_photo_url && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Finished Product &amp; Facility Location Photo</p>
                    <img
                      src={booking.facility_floor_photo_url}
                      alt="Finished product and location"
                      className="w-full rounded-xl border border-gray-200 object-cover max-h-56 shadow-sm"
                    />
                    <p className="text-sm text-gray-500 text-center">Use this photo to find the finished bags on arrival</p>
                  </div>
                )}
                {!booking.facility_floor_photo_url && (
                  <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    ⚠️ No finished-product photo yet — ask the operator before heading out.
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
          takenColors={takenColors}
          existingColorKey={booking.color_key ?? null}
          dropoffLocation={defaultDropoffLocation}
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
          enrouteAlreadySent={enrouteAlreadySent}
          notifyPickupEnroute={notifyPickupEnroute}
          confirmPickup={confirmPickup}
          confirmDropoff={confirmDropoff}
          confirmDelivery={confirmDelivery}
          recordPhotoEvent={recordPhotoEvent}
        />

        {/* Bag status grid */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">Bag Status</p>
          <div className="grid grid-cols-2 gap-2">
            {bags?.map((bag) => {
              const idx = ALL_STATUSES.indexOf(bag.status)
              return (
                <div key={bag.id} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#0D2240] font-mono text-base">B{bag.bag_number}</span>
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
