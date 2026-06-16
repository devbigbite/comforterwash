import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
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

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: booking } = await supabase
    .from("bookings")
    .select(`
      *,
      shipday_pickup_order_id,
      shipday_delivery_order_id,
      assigned_facility:facilities!assigned_facility_id(id, name, processing_mode, rate_per_lb, minimum_lbs, partner_access_code)
    `)
    .eq("id", id)
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

  const orderCode = booking.id.slice(0, 8).toUpperCase()

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
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/admin/orders/${id}/labels`}
              className="rounded-xl border-2 border-[#0D2240] text-[#0D2240] font-bold text-sm px-4 py-2 hover:bg-[#0D2240] hover:text-white transition-all">
              🏷️ Print Labels
            </Link>
            <Link href="/admin" className="text-sm text-gray-400 hover:text-[#0D2240] transition-colors">← Admin</Link>
          </div>
        </div>

        {/* Billing Breakdown — full width, top */}
        {billingCalculated ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <h2 className="font-bold text-[#0D2240] mb-4 text-sm uppercase tracking-wide">💰 Billing Breakdown</h2>
            <div className="grid grid-cols-4 gap-4">
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
          </div>
        ) : booking.service_type === "wash_fold" && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-sm text-amber-700">
            <span className="font-bold">⚖️ Billing pending</span> — weight not yet entered.
            Billing will be calculated once the driver or operator records the actual weight.
            {preAuthCents && ` Pre-authorized: $${(preAuthCents / 100).toFixed(2)}.`}
          </div>
        )}

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
