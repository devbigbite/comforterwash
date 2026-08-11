import { createAdminClient } from "@/lib/supabase/admin"
import { notFound, redirect } from "next/navigation"
import { format } from "date-fns"
import Link from "next/link"
import { revalidatePath } from "next/cache"
import {
  reschedulePickup,
  rescheduleDelivery,
  assignDriver,
  cancelShipdayOrders,
} from "@/app/actions/shipday"
import { getMiscFees } from "@/app/actions/fees"
import { MiscFeesPanel } from "./misc-fees-panel"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"
import { recordWeightAndCharge } from "@/app/actions/weigh-in"
import { capturePayment, chargeCommercialAccountOrder } from "@/app/actions/stripe"
import { sendPaymentUpdateLink } from "@/app/actions/commercial-accounts"
import { updateFacilityDetails } from "@/app/actions/facility-board"
import PhotoUploader from "@/app/operator/order/[id]/photo-uploader"
import { WeightEntryForm } from "@/components/admin/WeightEntryForm"
import { OrderSnapshot } from "@/components/admin/order-snapshot"

// bookings has its own location_id — every inline action below verifies the
// bookingId it's given actually belongs to the current tenant before doing
// anything, so an admin session for one tenant can't act on another's orders.
async function assertBookingOwnership(bookingId: string) {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase.from("bookings").select("id").eq("id", bookingId).eq("location_id", locationId).maybeSingle()
  if (!data) throw new Error("Order not found for this account")
}

const STATUS_COLORS: Record<string, string> = {
  pending:          "bg-gray-100 text-gray-500",
  picked_up:        "bg-blue-50 text-blue-700 border border-blue-200",
  at_facility:      "bg-purple-50 text-purple-700 border border-purple-200",
  in_washer:        "bg-cyan-50 text-cyan-700 border border-cyan-200",
  in_dryer:         "bg-orange-50 text-orange-700 border border-orange-200",
  folded:           "bg-yellow-50 text-yellow-700 border border-yellow-200",
  ready:            "bg-green-50 text-green-700 border border-green-200",
  out_for_delivery: "bg-green-600 text-white",
  delivered:        "bg-[#0D2240] text-white",
}

const EVENT_ICONS: Record<string, string> = {
  booking_created:         "📋",
  pickup_confirmed:        "🚚",
  bags_received:           "📦",
  processing_started:      "⚙️",
  bag_in_washer:           "🫧",
  bag_in_dryer:            "🌀",
  bag_folded:              "👕",
  ready_for_delivery:      "✅",
  out_for_delivery:        "🚐",
  delivered:               "🎉",
  photo_pickup:            "📷",
  photo_customer_pickup:   "📷",
  photo_facility_dropoff:  "📷",
  photo_facility_pickup:   "📷",
  photo_customer_delivery: "📷",
  weight_confirmed:        "⚖️",
  facility_assigned:       "🏭",
  facility_transfer:       "🔄",
  dispatch_rescheduled:    "📅",
  driver_assigned:         "👤",
  shipday_cancelled:       "❌",
  misc_fee_added:          "💳",
  misc_fee_paid:           "✅",
  misc_fee_waived:         "🙏",
}

// Statuses that indicate bags have physically arrived at / passed through facility
const PAST_PICKUP = ["at_facility", "in_washer", "in_dryer", "folded", "ready", "out_for_delivery", "delivered"]

async function assignFacility(formData: FormData) {
  "use server"
  const bookingId = formData.get("bookingId") as string
  const facilityId = formData.get("facilityId") as string
  await assertBookingOwnership(bookingId)

  const supabase = createAdminClient()
  await supabase.from("bookings").update({ assigned_facility_id: facilityId }).eq("id", bookingId)
  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: "facility_assigned",
    notes: `Facility assigned by admin`,
    created_by: "admin",
  })
  revalidatePath(`/admin/orders/${bookingId}`)
}

async function transferFacility(formData: FormData) {
  "use server"
  const bookingId = formData.get("bookingId") as string
  const newFacilityId = formData.get("newFacilityId") as string
  const requiresPhysicalTransfer = formData.get("requiresPhysicalTransfer") === "true"
  await assertBookingOwnership(bookingId)

  const supabase = createAdminClient()
  await supabase.from("bookings").update({ assigned_facility_id: newFacilityId }).eq("id", bookingId)
  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: "facility_transfer",
    notes: requiresPhysicalTransfer
      ? `⚠️ PHYSICAL TRANSFER REQUIRED — bags already at previous facility. Reassigned by admin.`
      : `Facility reassigned by admin (bags not yet delivered to prior facility)`,
    created_by: "admin",
  })
  revalidatePath(`/admin/orders/${bookingId}`)
}

async function reschedulePickupAction(formData: FormData) {
  "use server"
  const bookingId = formData.get("bookingId") as string
  const newDate = formData.get("newDate") as string
  const newWindow = formData.get("newWindow") as string
  await assertBookingOwnership(bookingId)
  const supabase = createAdminClient()
  await reschedulePickup(bookingId, newDate, newWindow)
  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: "dispatch_rescheduled",
    notes: `Pickup rescheduled to ${newDate} ${newWindow} — Shipday updated`,
    created_by: "admin",
  })
  revalidatePath(`/admin/orders/${bookingId}`)
}

async function rescheduleDeliveryAction(formData: FormData) {
  "use server"
  const bookingId = formData.get("bookingId") as string
  const newDate = formData.get("newDate") as string
  const newWindow = formData.get("newWindow") as string
  await assertBookingOwnership(bookingId)
  const supabase = createAdminClient()
  await rescheduleDelivery(bookingId, newDate, newWindow)
  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: "dispatch_rescheduled",
    notes: `Delivery rescheduled to ${newDate} ${newWindow} — Shipday updated`,
    created_by: "admin",
  })
  revalidatePath(`/admin/orders/${bookingId}`)
}

async function assignDriverAction(formData: FormData) {
  "use server"
  const bookingId = formData.get("bookingId") as string
  const driverEmail = formData.get("driverEmail") as string
  await assertBookingOwnership(bookingId)
  const supabase = createAdminClient()
  const { ok } = await assignDriver(bookingId, driverEmail)
  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: "driver_assigned",
    notes: ok
      ? `Driver assigned in Shipday: ${driverEmail}`
      : `Driver assignment attempted (${driverEmail}) — Shipday may not have this carrier on file`,
    created_by: "admin",
  })
  revalidatePath(`/admin/orders/${bookingId}`)
}

async function cancelShipdayAction(formData: FormData) {
  "use server"
  const bookingId = formData.get("bookingId") as string
  await assertBookingOwnership(bookingId)
  const supabase = createAdminClient()
  await cancelShipdayOrders(bookingId)
  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: "shipday_cancelled",
    notes: `Shipday pickup + delivery orders cancelled by admin`,
    created_by: "admin",
  })
  revalidatePath(`/admin/orders/${bookingId}`)
}

// Weight entry from the admin page — routes through the same
// recordWeightAndCharge used by the operator station (app/actions/weigh-in.ts)
// so there's one billing-critical code path, not a third copy of the pricing
// math. Idempotency-guarded there, so this can't double-charge even if an
// operator and admin both submit a weight for the same order.
async function enterWeightAction(formData: FormData) {
  "use server"
  const bookingId = formData.get("bookingId") as string
  const weightLbs = parseFloat(formData.get("weightLbs") as string)
  await assertBookingOwnership(bookingId)
  const result = await recordWeightAndCharge(bookingId, weightLbs, "admin")
  const supabase = createAdminClient()
  if (result.error) {
    await supabase.from("order_events").insert({
      booking_id: bookingId,
      event_type: "weight_confirmed",
      notes: `Admin weight entry failed: ${result.error}`,
      created_by: "admin",
    })
  } else if (result.success) {
    await supabase.from("order_events").insert({
      booking_id: bookingId,
      event_type: "weight_confirmed",
      notes: `Weight entered by admin: ${weightLbs} lbs${result.customerFinalCents ? ` · Billed $${(result.customerFinalCents / 100).toFixed(2)}` : ""}`,
      created_by: "admin",
    })
  }
  revalidatePath(`/admin/orders/${bookingId}`)
}

// Manual "Capture Payment" — surfaces the same capturePayment() that
// confirmDropoff/recordWeightAndCharge already call automatically, for the
// case where that automatic call never fired or silently failed (e.g. the
// driver-app booking-update bug that left weight/billing unset even though
// the timeline showed a weight — see order_events "⚠ Weight/billing save
// FAILED"). Gives admin a real button instead of needing a DB fix each time.
// Both actions below previously ended with just revalidatePath — if the
// underlying Stripe call failed again (e.g. the same declined Link
// connection), the page re-rendered looking identical to before the click,
// with zero visible feedback that anything had even run. The only trace was
// a note buried in the order_events timeline further down the page, easy to
// miss. Now redirecting with a billingMsg param the page reads and shows as
// a banner right at the top, so a failed retry is impossible to miss.
async function captureNowAction(formData: FormData) {
  "use server"
  const bookingId = formData.get("bookingId") as string
  await assertBookingOwnership(bookingId)
  const supabase = createAdminClient()
  let msg: string
  try {
    await capturePayment(bookingId)
    await supabase.from("order_events").insert({
      booking_id: bookingId, event_type: "weight_confirmed",
      notes: "Payment captured manually by admin", created_by: "admin",
    })
    msg = "ok:Payment captured successfully."
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "unknown error"
    await supabase.from("order_events").insert({
      booking_id: bookingId, event_type: "weight_confirmed",
      notes: `Manual capture failed: ${errMsg}`,
      created_by: "admin",
    })
    msg = `err:Capture failed — ${errMsg}`
  }
  revalidatePath(`/admin/orders/${bookingId}`)
  redirect(`/admin/orders/${bookingId}?billingMsg=${encodeURIComponent(msg)}`)
}

// Manual "Retry Charge" for commercial pay-at-service accounts — each call
// creates a fresh Stripe PaymentIntent (chargeCommercialAccountOrder doesn't
// reuse the failed one), so this is safe to click again after fixing
// whatever caused the decline (expired card, closed Link connection, etc).
async function retryCommercialChargeAction(formData: FormData) {
  "use server"
  const bookingId = formData.get("bookingId") as string
  await assertBookingOwnership(bookingId)
  const supabase = createAdminClient()
  const result = await chargeCommercialAccountOrder(bookingId)
  await supabase.from("order_events").insert({
    booking_id: bookingId, event_type: "weight_confirmed",
    notes: result.success ? "Commercial charge retried and succeeded (admin)" : `Retry failed: ${result.error}`,
    created_by: "admin",
  })
  const msg = result.success ? "ok:Charge succeeded." : `err:Charge failed again — ${result.error}`
  revalidatePath(`/admin/orders/${bookingId}`)
  redirect(`/admin/orders/${bookingId}?billingMsg=${encodeURIComponent(msg)}`)
}

// Sends the commercial account's existing self-serve access_code link (see
// /commercial-agreement/[code], which now offers an "Update Payment Method"
// option even once a card is already on file) so a customer whose card is
// declining — e.g. "connection to the user's Link account has been closed" —
// can fix it themselves instead of it requiring a manual admin/DB fix.
async function sendPaymentUpdateLinkAction(formData: FormData) {
  "use server"
  const bookingId = formData.get("bookingId") as string
  const commercialAccountId = formData.get("commercialAccountId") as string
  await assertBookingOwnership(bookingId)
  const result = await sendPaymentUpdateLink(commercialAccountId)
  const msg = result.success ? "ok:Update-payment link sent to the customer." : `err:${result.error}`
  redirect(`/admin/orders/${bookingId}?billingMsg=${encodeURIComponent(msg)}`)
}

// Bag count adjustment — same reconciliation approach as the driver app's
// confirmPickup (app/driver/order/[id]/page.tsx): if the new count is higher,
// append new order_bags rows with sequential label codes; if lower, remove
// rows off the end. Lets an admin fix a miscount without needing to go
// through the driver flow, e.g. a bag was missed at pickup or double-counted.
async function adjustBagCountAction(formData: FormData) {
  "use server"
  const bookingId = formData.get("bookingId") as string
  const newCount = parseInt(formData.get("bagCount") as string, 10)
  await assertBookingOwnership(bookingId)
  if (isNaN(newCount) || newCount < 1) return

  const supabase = createAdminClient()

  const { data: existingBags } = await supabase
    .from("order_bags")
    .select("id, bag_number")
    .eq("booking_id", bookingId)
    .order("bag_number")

  const currentCount = existingBags?.length ?? 0

  if (newCount !== currentCount) {
    if (newCount > currentCount) {
      const orderCode = bookingId.slice(0, 6).toUpperCase()
      const newBags = []
      for (let i = currentCount + 1; i <= newCount; i++) {
        newBags.push({
          booking_id: bookingId,
          bag_number: i,
          label_code: `${orderCode}-B${i}`,
          status: "pending",
        })
      }
      await supabase.from("order_bags").insert(newBags)
    } else {
      const toDelete = existingBags!.slice(newCount).map(b => b.id)
      await supabase.from("order_bags").delete().in("id", toDelete)
    }

    await supabase.from("bookings").update({ num_bags: newCount }).eq("id", bookingId)
    await supabase.from("order_events").insert({
      booking_id: bookingId,
      event_type: "bags_received",
      notes: `Bag count adjusted by admin: ${currentCount} → ${newCount}`,
      created_by: "admin",
    })
  }
  revalidatePath(`/admin/orders/${bookingId}`)
}

// Photo-capture actions — one per event type, matching the driver/operator
// flow's existing conventions (same event_type strings, so timeline icons
// and downstream reporting already handle these). Lets an admin acting on
// behalf of a solo/home-based tenant log the same proof-of-service photos
// without switching into /driver or /operator.
async function logPhotoAction(eventType: string, notes: string, formData: FormData) {
  "use server"
  const bookingId = formData.get("bookingId") as string
  const photoUrl = formData.get("photoUrl") as string
  await assertBookingOwnership(bookingId)
  const supabase = createAdminClient()
  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: eventType,
    notes,
    photo_url: photoUrl,
    created_by: "admin",
  })
  revalidatePath(`/admin/orders/${bookingId}`)
}

async function logCustomerPickupPhoto(formData: FormData) {
  "use server"
  await logPhotoAction("photo_customer_pickup", "Pickup photo logged by admin", formData)
}
async function logFacilityDropoffPhoto(formData: FormData) {
  "use server"
  await logPhotoAction("photo_facility_dropoff", "Facility drop-off photo logged by admin", formData)
}
async function logFacilityPickupPhoto(formData: FormData) {
  "use server"
  await logPhotoAction("photo_facility_pickup", "Driver pickup-of-clean-bags photo logged by admin", formData)
}
async function logCustomerDeliveryPhoto(formData: FormData) {
  "use server"
  await logPhotoAction("photo_customer_delivery", "Delivery photo logged by admin", formData)
}

// Finished Product & Facility Location photo — this is the operator's photo
// of the finished, packaged bags and where they're placed at the facility,
// distinct from the driver's own pickup-accountability photo above. It's
// stored on the booking itself (facility_floor_photo_url), not as an
// order_event, matching how the Facility Board (app/admin/facility) and the
// driver app already read/write it — same field, same photo, visible from
// whichever screen an admin happens to be on.
async function logFinishedProductPhoto(formData: FormData) {
  "use server"
  const bookingId = formData.get("bookingId") as string
  const photoUrl = formData.get("photoUrl") as string
  await assertBookingOwnership(bookingId)
  await updateFacilityDetails(bookingId, { facility_floor_photo_url: photoUrl })
  revalidatePath(`/admin/orders/${bookingId}`)
}

export default async function OrderDetailPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ billingMsg?: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const { billingMsg } = await searchParams
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]

  const { data: booking } = await supabase
    .from("bookings")
    .select(`
      *,
      shipday_pickup_order_id,
      shipday_delivery_order_id,
      assigned_facility:facilities!assigned_facility_id(id, name, processing_mode, rate_per_lb, minimum_lbs, partner_access_code),
      assigned_driver:workers!assigned_driver_id(name),
      assigned_delivery_driver:workers!assigned_delivery_driver_id(name),
      assigned_operator:workers!assigned_operator_id(name)
    `)
    .eq("id", id)
    .eq("location_id", locationId)
    .single()

  if (!booking) notFound()

  const { data: bags } = await supabase
    .from("order_bags")
    .select("*, machines(name, machine_groups(name, type, facilities(name)))")
    .eq("booking_id", id)
    .order("bag_number")

  const { data: events } = await supabase
    .from("order_events")
    .select("*, machines(name, machine_groups(name, type, facilities(name))), order_bags(label_code, bag_number)")
    .eq("booking_id", id)
    .order("created_at", { ascending: false })

  const { data: allFacilities } = await supabase
    .from("facilities")
    .select("id, name, processing_mode, rate_per_lb, minimum_lbs")
    .eq("active", true)
    .order("name")

  const miscFees = await getMiscFees(id)

  // Photos already on file per event type — passed into each PhotoUploader
  // as initialPhotos so a page refresh shows what's actually saved instead
  // of an empty "No photos yet" state (the uploader otherwise only tracks
  // uploads made in the current browser session).
  const photosByEvent = (eventType: string) =>
    (events ?? [])
      .filter(e => e.event_type === eventType && e.photo_url)
      .map(e => e.photo_url as string)

  // short_code is the one real order number staff and customers both use
  // (matches the Order Snapshot card, receipts, dispatch, etc). Only fall
  // back to a UUID fragment for old rows that predate short_code.
  const orderCode = (booking.short_code as string | null)?.toUpperCase()
    ?? booking.id.slice(0, 8).toUpperCase()

  const assignedFacility = booking.assigned_facility as {
    id: string; name: string; processing_mode: string
    rate_per_lb: number | null; minimum_lbs: number
    partner_access_code: string | null
  } | null

  // Estimate weight for margin warning (actual if set, else estimated from form)
  const estimatedLbs = (booking.actual_weight_lbs as number | null)
    ?? (booking.service_type === "wash_fold" ? (booking.pounds as number | null) : null)

  // Billing figures
  const customerFinalCents = booking.customer_final_cents as number | null
  const facilityCostCents = booking.facility_cost_cents as number | null
  const preAuthCents = booking.pre_auth_cents as number | null
  const actualWeightLbs  = booking.actual_weight_lbs as number | null
  const foldedWeightLbs  = booking.folded_weight_lbs != null ? parseFloat(String(booking.folded_weight_lbs)) : null
  const weightDiscrepancy = (actualWeightLbs && foldedWeightLbs)
    ? Math.abs(foldedWeightLbs - actualWeightLbs)
    : null
  const weightFlagged    = weightDiscrepancy !== null && weightDiscrepancy >= 4

  // Has billing been calculated?
  const billingCalculated = !!(customerFinalCents && facilityCostCents !== null)

  // Shipday sync status
  const shipdayPickupId = booking.shipday_pickup_order_id as number | null
  const shipdayDeliveryId = booking.shipday_delivery_order_id as number | null
  const shipdaySynced = !!(shipdayPickupId || shipdayDeliveryId)

  // Check if bags have physically arrived (transfer would require physical move)
  const bagStatuses = bags?.map(b => b.status) ?? []
  const bagsAtFacility = bagStatuses.some(s => PAST_PICKUP.includes(s))

  // Margin warning for facility assignment
  const facilityMinForWarning = (fId: string) => {
    const f = allFacilities?.find(f => f.id === fId)
    if (!f || !estimatedLbs) return false
    return f.minimum_lbs > estimatedLbs
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-10">

        {/* Weight discrepancy flag */}
        {weightFlagged && (
          <div className="mb-6 bg-red-600 rounded-2xl px-5 py-4 flex items-start gap-3">
            <span className="text-2xl shrink-0">🚨</span>
            <div>
              <p className="text-white font-extrabold text-base uppercase tracking-wide">Weight Discrepancy — Action Required</p>
              <p className="text-white/90 text-sm mt-1">
                Intake: <span className="font-bold">{actualWeightLbs} lbs</span> · Folded: <span className="font-bold">{foldedWeightLbs} lbs</span> · Difference: <span className="font-bold">{weightDiscrepancy!.toFixed(1)} lbs</span>
              </p>
              <p className="text-white/70 text-xs mt-1">
                A 4+ lb difference was detected between intake and folded weights. Verify no items are missing before this order goes out for delivery. Contact the operator and check the facility.
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-extrabold text-[#0D2240] font-mono">{orderCode}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                STATUS_COLORS[booking.status] ?? "bg-gray-100 text-gray-500"
              }`}>
                {booking.status?.replace(/_/g, " ")}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#f7f8fb] border border-gray-200 text-gray-500 uppercase">
                {booking.service_type === "wash_fold" ? "Wash & Fold" : "Comforter Wash"}
              </span>
            </div>
            <p className="text-sm text-gray-400">{booking.customer_name} · {booking.customer_phone}</p>
            <p className="text-[10px] text-gray-300 font-mono mt-0.5">internal id: {booking.id}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/admin/orders/${id}/labels`}
              className="rounded-xl border-2 border-[#0D2240] text-[#0D2240] font-bold text-sm px-4 py-2 hover:bg-[#0D2240] hover:text-white transition-all">
              🏷️ Print Labels
            </Link>
            <Link href="/admin" className="text-sm text-gray-400 hover:text-[#0D2240] transition-colors">← Admin</Link>
          </div>
        </div>

        {billingMsg && (
          <div className={`mb-6 rounded-2xl border p-4 text-sm font-semibold ${
            billingMsg.startsWith("ok:") ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
          }`}>
            {billingMsg.startsWith("ok:") ? "✅ " : "⚠️ "}{billingMsg.slice(billingMsg.indexOf(":") + 1)}
          </div>
        )}

        {/* Order Snapshot — at-a-glance pickup/delivery timing, what's inside,
            who it's for, who's handling it, what it costs. Everything below
            this (billing breakdown, photos, event log) is the deep-dive view;
            this card exists so nobody has to scroll through all of that just
            to answer "when's this picked up / what's in it." */}
        <div className="mb-6">
          <OrderSnapshot order={booking} />
        </div>

        {/* Billing Breakdown — full width, top */}
        {billingCalculated ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <h2 className="font-bold text-[#0D2240] mb-4 text-sm uppercase tracking-wide">💰 Billing Breakdown</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="text-center bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Actual Weight</p>
                <p className="text-2xl font-extrabold text-[#0D2240]">{actualWeightLbs ?? "—"}</p>
                <p className="text-xs text-gray-400">lbs</p>
              </div>
              <div className="text-center bg-green-50 border border-green-100 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Customer Revenue</p>
                <p className="text-2xl font-extrabold text-green-700">${(customerFinalCents! / 100).toFixed(2)}</p>
                <p className="text-xs text-gray-400">captured</p>
              </div>
              <div className="text-center bg-red-50 border border-red-100 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Facility Cost</p>
                <p className="text-2xl font-extrabold text-red-600">${(facilityCostCents! / 100).toFixed(2)}</p>
                <p className="text-xs text-gray-400">
                  {assignedFacility ? `${assignedFacility.name}` : "facility"}
                </p>
              </div>
              <div className={`text-center rounded-xl p-4 border ${
                (customerFinalCents! - facilityCostCents!) > 0
                  ? "bg-blue-50 border-blue-100"
                  : "bg-amber-50 border-amber-200"
              }`}>
                <p className="text-xs text-gray-400 mb-1">WashFold Margin</p>
                <p className={`text-2xl font-extrabold ${
                  (customerFinalCents! - facilityCostCents!) > 0 ? "text-blue-700" : "text-amber-600"
                }`}>
                  ${((customerFinalCents! - facilityCostCents!) / 100).toFixed(2)}
                </p>
                <p className="text-xs text-gray-400">
                  {Math.round(((customerFinalCents! - facilityCostCents!) / customerFinalCents!) * 100)}%
                </p>
              </div>
            </div>
            {preAuthCents && (
              <p className="text-xs text-gray-400 mt-3 text-center">
                Pre-authorized: ${(preAuthCents / 100).toFixed(2)} ·
                Payment: <span className="font-semibold">{booking.payment_status}</span>
              </p>
            )}

            {/* Consumer pre-auth still uncaptured — happens when the
                automatic capture in confirmDropoff/recordWeightAndCharge
                never fired (network blip, or the booking-update bug that
                left weight set but skipped the capture step entirely). */}
            {!booking.commercial_account_id && booking.payment_status === "pre_authorized" && (
              <form action={captureNowAction} className="mt-4 flex flex-col items-center gap-1">
                <input type="hidden" name="bookingId" value={booking.id} />
                <button type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors">
                  💳 Capture Payment — ${(customerFinalCents! / 100).toFixed(2)}
                </button>
                <p className="text-xs text-gray-400">Charges the card on file for the billed amount now.</p>
              </form>
            )}

            {/* Commercial pay-at-service charge failed (declined card, closed
                Link connection, etc). Each retry creates a fresh
                PaymentIntent, so it's safe to click again after fixing the
                payment method on file. */}
            {booking.commercial_account_id && booking.payment_status === "failed" && (
              <div className="mt-4 flex flex-col items-center gap-2">
                <form action={retryCommercialChargeAction}>
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <button type="submit"
                    className="bg-red-600 hover:bg-red-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors">
                    🔁 Retry Charge — ${(customerFinalCents! / 100).toFixed(2)}
                  </button>
                </form>
                <p className="text-xs text-gray-400">Verify the commercial account's card on file before retrying.</p>
                <form action={sendPaymentUpdateLinkAction}>
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <input type="hidden" name="commercialAccountId" value={booking.commercial_account_id} />
                  <button type="submit"
                    className="text-[#0D2240] font-bold text-sm px-4 py-2 rounded-xl border-2 border-[#0D2240] hover:bg-[#0D2240] hover:text-white transition-colors">
                    💳 Send Update Payment Link to Customer
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : booking.service_type === "wash_fold" && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-sm text-amber-700">
            <span className="font-bold">⚖️ Billing pending</span> — weight not yet entered.
            Billing will be calculated once the driver or operator records the actual weight.
            {preAuthCents && ` Pre-authorized: $${(preAuthCents / 100).toFixed(2)}.`}
          </div>
        )}

        {/* Weight entry — one field per bag (matches how weighing actually
            happens at the scale, and surfaces a bag miscount before billing)
            summed into the total that recordWeightAndCharge expects. */}
        {!actualWeightLbs && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <h2 className="font-bold text-[#0D2240] mb-3 text-sm uppercase tracking-wide">⚖️ Enter Weight</h2>
            <WeightEntryForm
              bookingId={booking.id}
              bagCount={bags?.length || (booking.num_bags as number | null) || 1}
              action={enterWeightAction}
            />
          </div>
        )}

        {/* Finished Product & Facility Location — the operator's photo of the
            packaged bags and where they're placed, taken when processing
            finishes. Read from the booking itself (facility_floor_photo_url),
            same field the Facility Board and driver app already use — not an
            order_event like the four photos below. */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-gray-50">
            <h3 className="font-bold text-[#0D2240] text-sm">📦 Finished Product &amp; Facility Location Photo</h3>
            <p className="text-xs text-gray-400 mt-0.5">Taken by the operator when the order is packaged — shows the driver what to grab and where.</p>
          </div>
          {booking.facility_floor_photo_url && (
            <div className="p-4 pb-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={booking.facility_floor_photo_url as string}
                alt="Finished product and location"
                className="w-full rounded-xl border border-gray-100 max-h-56 object-cover"
              />
            </div>
          )}
          <div className="p-4">
            <PhotoUploader
              bookingId={id}
              action={logFinishedProductPhoto}
              label={booking.facility_floor_photo_url ? "Replace photo" : "📷 Finished Product & Location Photo"}
              compact
            />
          </div>
        </div>

        {/* Photo capture — driver flow photos, logged straight from the admin page */}
        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <PhotoUploader bookingId={id} action={logCustomerPickupPhoto} label="📷 Customer Pickup Photo" compact={false} initialPhotos={photosByEvent("photo_customer_pickup")} />
          <PhotoUploader bookingId={id} action={logFacilityDropoffPhoto} label="📷 Facility/Warehouse Drop-off Photo" compact={false} initialPhotos={photosByEvent("photo_facility_dropoff")} />
          <PhotoUploader bookingId={id} action={logFacilityPickupPhoto} label="📷 Driver Pickup of Clean Bags Photo" compact={false} initialPhotos={photosByEvent("photo_facility_pickup")} />
          <PhotoUploader bookingId={id} action={logCustomerDeliveryPhoto} label="📷 Customer Delivery Photo" compact={false} initialPhotos={photosByEvent("photo_customer_delivery")} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">

          {/* Order info */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-[#0D2240] mb-4 text-sm uppercase tracking-wide">Order Details</h2>
            <dl className="space-y-2.5 text-sm">
              {[
                { label: "Customer", value: booking.customer_name },
                { label: "Email", value: booking.customer_email },
                { label: "Phone", value: booking.customer_phone },
                { label: "Address", value: booking.customer_address },
                { label: "Pickup", value: `${booking.pickup_date} · ${booking.pickup_time_window}` },
                { label: "Delivery", value: `${booking.delivery_date} · ${booking.delivery_time_window}` },
                { label: "Service", value: booking.service_type === "wash_fold" ? "Wash & Fold" : "Comforter Wash" },
                { label: "Items", value: booking.service_type === "wash_fold" ? `~${booking.pounds} lbs est.` : `${booking.num_comforters} comforter(s)` },
                { label: "Bags", value: `${booking.num_bags ?? bags?.length ?? 1} bag(s)` },
                { label: "Pre-auth", value: preAuthCents ? `$${(preAuthCents / 100).toFixed(2)}` : "—" },
                { label: "Paid", value: booking.payment_status },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-3">
                  <dt className="text-gray-400 w-20 shrink-0">{label}</dt>
                  <dd className="font-medium text-[#0D2240]">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Right column: facility + bags */}
          <div className="space-y-6">

            {/* Facility Assignment */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="font-bold text-[#0D2240] mb-4 text-sm uppercase tracking-wide">🏭 Facility</h2>

              {assignedFacility ? (
                <div className="space-y-3">
                  {/* Current facility info */}
                  <div className="rounded-xl bg-[#f7f8fb] border border-gray-100 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-[#0D2240]">{assignedFacility.name}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        assignedFacility.processing_mode === "partner_attendant"
                          ? "bg-purple-50 text-purple-700 border border-purple-200"
                          : "bg-blue-50 text-blue-700 border border-blue-200"
                      }`}>
                        {assignedFacility.processing_mode === "partner_attendant" ? "Partner" : "Own Operator"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {assignedFacility.rate_per_lb
                        ? `$${assignedFacility.rate_per_lb}/lb · min ${assignedFacility.minimum_lbs ?? 0} lbs`
                        : "No rate configured"}
                    </p>
                    {assignedFacility.processing_mode === "partner_attendant" && assignedFacility.partner_access_code && (
                      <a href={`/partner/${assignedFacility.partner_access_code}`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[#E8726A] font-semibold mt-1.5 hover:underline">
                        Open Partner Portal ↗
                      </a>
                    )}
                  </div>

                  {/* Margin warning for assigned facility */}
                  {estimatedLbs && assignedFacility.minimum_lbs > estimatedLbs && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                      ⚠️ Facility min ({assignedFacility.minimum_lbs} lbs) exceeds estimated weight ({estimatedLbs} lbs).
                      Facility will be billed at minimum — check margin.
                    </div>
                  )}

                  {/* Transfer to different facility */}
                  <details className="group">
                    <summary className="cursor-pointer text-xs text-gray-400 hover:text-[#0D2240] font-semibold transition-colors list-none flex items-center gap-1">
                      <span className="group-open:hidden">+ Transfer to different facility</span>
                      <span className="hidden group-open:inline">− Cancel transfer</span>
                    </summary>
                    <div className="mt-3">
                      {bagsAtFacility && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 font-semibold mb-3">
                          ⚠️ Bags have already been physically dropped at {assignedFacility.name}.
                          This transfer will require coordinating a physical bag pickup and re-drop.
                        </div>
                      )}
                      <form action={transferFacility} className="flex flex-col gap-2">
                        <input type="hidden" name="bookingId" value={booking.id} />
                        <input type="hidden" name="requiresPhysicalTransfer" value={String(bagsAtFacility)} />
                        <select name="newFacilityId" required
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30">
                          <option value="">— select new facility —</option>
                          {allFacilities?.filter(f => f.id !== assignedFacility.id).map(f => (
                            <option key={f.id} value={f.id}>
                              {f.name} · {f.processing_mode === "partner_attendant" ? "Partner" : "Own Op"}
                              {f.rate_per_lb ? ` · $${f.rate_per_lb}/lb` : ""}
                              {f.minimum_lbs ? ` · min ${f.minimum_lbs} lbs` : ""}
                            </option>
                          ))}
                        </select>
                        <button type="submit"
                          className={`w-full rounded-xl font-bold text-xs py-2.5 text-white transition-colors ${
                            bagsAtFacility
                              ? "bg-red-500 hover:bg-red-600"
                              : "bg-[#0D2240] hover:bg-[#1a3a5c]"
                          }`}>
                          {bagsAtFacility ? "⚠️ Transfer (Physical Move Required)" : "Transfer Facility"}
                        </button>
                      </form>
                    </div>
                  </details>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400">No facility assigned yet.</p>

                  {/* Margin warning preview */}
                  {estimatedLbs && (
                    <p className="text-xs text-gray-400">
                      Estimated weight: <span className="font-semibold text-[#0D2240]">{estimatedLbs} lbs</span>
                      {" "}· Facilities with higher minimums will reduce margin.
                    </p>
                  )}

                  <form action={assignFacility} className="flex flex-col gap-2">
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <select name="facilityId" required
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30">
                      <option value="">— select facility —</option>
                      {allFacilities?.map(f => {
                        const hasMarginWarning = facilityMinForWarning(f.id)
                        return (
                          <option key={f.id} value={f.id}>
                            {hasMarginWarning ? "⚠️ " : ""}{f.name}
                            {" · "}{f.processing_mode === "partner_attendant" ? "Partner" : "Own Op"}
                            {f.rate_per_lb ? ` · $${f.rate_per_lb}/lb` : ""}
                            {f.minimum_lbs ? ` · min ${f.minimum_lbs} lbs` : ""}
                          </option>
                        )
                      })}
                    </select>
                    <button type="submit"
                      className="w-full rounded-xl bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm py-2.5 transition-colors">
                      Assign Facility
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Bags */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="font-bold text-[#0D2240] mb-4 text-sm uppercase tracking-wide">
                Bags ({bags?.length ?? 0})
              </h2>

              {/* Adjust bag count — inserts/removes order_bags rows to match,
                  same reconciliation logic the driver app uses at pickup. */}
              <form action={adjustBagCountAction} className="flex items-end gap-2 mb-4">
                <input type="hidden" name="bookingId" value={booking.id} />
                <div className="flex-1 max-w-[110px]">
                  <label className="text-xs text-gray-400 mb-1 block">Bag count</label>
                  <input
                    type="number"
                    name="bagCount"
                    min="1"
                    step="1"
                    defaultValue={bags?.length || booking.num_bags || 1}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-xl bg-[#0D2240] hover:bg-[#1a3a5c] text-white font-bold text-xs px-4 py-2.5 transition-colors"
                >
                  Update Count
                </button>
              </form>

              <div className="space-y-3">
                {bags?.map((bag) => (
                  <div key={bag.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#f7f8fb] border border-gray-100">
                    <div className="w-10 h-10 rounded-xl bg-[#0D2240] flex items-center justify-center shrink-0">
                      <span className="text-white font-extrabold text-sm font-mono">B{bag.bag_number}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#0D2240] text-sm font-mono">{bag.label_code}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">
                        {bag.status?.replace(/_/g, " ")}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0 ${
                      STATUS_COLORS[bag.status] ?? "bg-gray-100 text-gray-500"
                    }`}>
                      {bag.status?.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
                {(!bags || bags.length === 0) && (
                  <p className="text-sm text-gray-400 text-center py-4">No bags created yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dispatch / Shipday */}
        <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-[#0D2240] text-sm uppercase tracking-wide">🚚 Dispatch</h2>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
              shipdaySynced
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${shipdaySynced ? "bg-green-500" : "bg-amber-400"}`} />
              {shipdaySynced ? "Synced with Shipday" : "Not yet in Shipday"}
            </div>
          </div>

          {shipdaySynced && (
            <div className="flex gap-3 mb-5 text-xs text-gray-400 font-mono">
              {shipdayPickupId && (
                <span className="bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
                  Pickup ID: <span className="font-bold text-[#0D2240]">{shipdayPickupId}</span>
                </span>
              )}
              {shipdayDeliveryId && (
                <span className="bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
                  Delivery ID: <span className="font-bold text-[#0D2240]">{shipdayDeliveryId}</span>
                </span>
              )}
            </div>
          )}

          {!shipdaySynced && (
            <p className="text-sm text-gray-400 mb-5">
              This order predates Shipday ID tracking. New orders will have IDs automatically stored on creation.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-3">

            {/* Reschedule Pickup */}
            <div className="rounded-xl border border-gray-100 bg-[#f7f8fb] p-4">
              <p className="text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-3">📅 Reschedule Pickup</p>
              <p className="text-xs text-gray-400 mb-3">
                Currently: <span className="font-semibold text-[#0D2240]">{booking.pickup_date} · {booking.pickup_time_window}</span>
              </p>
              <form action={reschedulePickupAction} className="space-y-2">
                <input type="hidden" name="bookingId" value={booking.id} />
                <input
                  type="date"
                  name="newDate"
                  defaultValue={booking.pickup_date}
                  required
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
                />
                <select
                  name="newWindow"
                  defaultValue={booking.pickup_time_window}
                  required
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
                >
                  <option value="9am-1pm">9am – 1pm</option>
                  <option value="3pm-7pm">3pm – 7pm</option>
                </select>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-[#0D2240] hover:bg-[#1a3a5c] text-white font-bold text-xs py-2 transition-colors"
                >
                  {shipdaySynced ? "Update Pickup → Shipday" : "Update Pickup"}
                </button>
              </form>
            </div>

            {/* Reschedule Delivery */}
            <div className="rounded-xl border border-gray-100 bg-[#f7f8fb] p-4">
              <p className="text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-3">📅 Reschedule Delivery</p>
              <p className="text-xs text-gray-400 mb-3">
                Currently: <span className="font-semibold text-[#0D2240]">{booking.delivery_date} · {booking.delivery_time_window}</span>
              </p>
              <form action={rescheduleDeliveryAction} className="space-y-2">
                <input type="hidden" name="bookingId" value={booking.id} />
                <input
                  type="date"
                  name="newDate"
                  defaultValue={booking.delivery_date}
                  required
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
                />
                <select
                  name="newWindow"
                  defaultValue={booking.delivery_time_window}
                  required
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
                >
                  <option value="9am-1pm">9am – 1pm</option>
                  <option value="3pm-7pm">3pm – 7pm</option>
                </select>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-[#0D2240] hover:bg-[#1a3a5c] text-white font-bold text-xs py-2 transition-colors"
                >
                  {shipdaySynced ? "Update Delivery → Shipday" : "Update Delivery"}
                </button>
              </form>
            </div>

            {/* Assign Driver */}
            <div className="rounded-xl border border-gray-100 bg-[#f7f8fb] p-4">
              <p className="text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-3">👤 Assign Driver</p>
              <p className="text-xs text-gray-400 mb-3">
                Enter the driver's email as registered in Shipday.
              </p>
              <form action={assignDriverAction} className="space-y-2">
                <input type="hidden" name="bookingId" value={booking.id} />
                <input
                  type="email"
                  name="driverEmail"
                  placeholder="driver@example.com"
                  required
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-[#0D2240] placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
                />
                <button
                  type="submit"
                  disabled={!shipdaySynced}
                  className="w-full rounded-lg bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs py-2 transition-colors"
                >
                  Assign in Shipday
                </button>
                {!shipdaySynced && (
                  <p className="text-[10px] text-gray-400 text-center">No Shipday order to assign to yet</p>
                )}
              </form>

              {/* Danger: cancel */}
              {shipdaySynced && (
                <details className="mt-4 group">
                  <summary className="cursor-pointer text-[10px] text-red-400 hover:text-red-600 font-semibold transition-colors list-none">
                    Cancel Shipday orders…
                  </summary>
                  <form action={cancelShipdayAction} className="mt-2">
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-xs py-2 transition-colors"
                    >
                      ❌ Cancel Both Shipday Orders
                    </button>
                    <p className="text-[10px] text-gray-400 mt-1 text-center">This removes them from driver route queues</p>
                  </form>
                </details>
              )}
            </div>

          </div>
        </div>

        {/* Misc Fees */}
        <MiscFeesPanel bookingId={id} initialFees={miscFees} />

        {/* Event timeline */}
        <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-[#0D2240] mb-5 text-sm uppercase tracking-wide">Order Timeline</h2>
          {!events || events.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No events recorded yet.</p>
          ) : (
            <div className="space-y-4">
              {events.map((event, i) => (
                <div key={event.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full bg-[#f7f8fb] border-2 border-gray-100 flex items-center justify-center text-base shrink-0">
                      {EVENT_ICONS[event.event_type] ?? "📌"}
                    </div>
                    {i < events.length - 1 && <div className="w-0.5 flex-1 bg-gray-100 mt-1" />}
                  </div>
                  <div className="pb-4 flex-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-bold text-[#0D2240] text-sm capitalize">
                        {event.event_type.replace(/_/g, " ")}
                      </span>
                      {event.order_bags && (
                        <span className="text-xs bg-[#0D2240] text-white px-2 py-0.5 rounded-full font-mono">
                          {(event.order_bags as { label_code: string }).label_code}
                        </span>
                      )}
                      {event.machines && (
                        <span className="text-xs bg-[#E8726A]/10 text-[#E8726A] px-2 py-0.5 rounded-full font-bold">
                          {(event.machines as { name: string }).name}
                        </span>
                      )}
                    </div>
                    {event.photo_url && (
                      <a href={event.photo_url} target="_blank" rel="noreferrer" className="block mt-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={event.photo_url}
                          alt="Pickup photo"
                          className="rounded-xl border border-gray-100 max-h-48 max-w-xs object-cover hover:opacity-90 transition-opacity"
                        />
                      </a>
                    )}
                    {event.notes && !event.photo_url && <p className="text-sm text-gray-500 mt-0.5">{event.notes}</p>}
                    <p className="text-xs text-gray-300 mt-1">
                      {format(new Date(event.created_at), "MMM d, h:mm a")}
                      {event.created_by && event.created_by !== "system" && ` · ${event.created_by}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
