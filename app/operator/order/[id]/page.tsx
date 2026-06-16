import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import Link from "next/link"
import { revalidatePath } from "next/cache"
import { stripe } from "@/lib/stripe"
import PhotoUploader from "./photo-uploader"

// Operator steps — wash_only skips the folding step
type StepDef = { action: string; next: string; color: string; needsMachine: boolean; needsFoldingNotes?: boolean }
const OPERATOR_STEPS_FULL: Record<string, StepDef> = {
  at_facility:  { action: "Load into Washer",      next: "in_washer", color: "bg-cyan-600 hover:bg-cyan-700",    needsMachine: true  },
  in_washer:    { action: "Move to Dryer",          next: "in_dryer",  color: "bg-orange-500 hover:bg-orange-600", needsMachine: true  },
  in_dryer:     { action: "Mark as Folded",         next: "folded",    color: "bg-yellow-500 hover:bg-yellow-600", needsMachine: false, needsFoldingNotes: true },
  folded:       { action: "Mark Ready for Pickup",  next: "ready",     color: "bg-green-600 hover:bg-green-700",   needsMachine: false },
}
const OPERATOR_STEPS_WASH_ONLY: Record<string, StepDef> = {
  at_facility:  { action: "Load into Washer",      next: "in_washer", color: "bg-cyan-600 hover:bg-cyan-700",    needsMachine: true  },
  in_washer:    { action: "Move to Dryer",          next: "in_dryer",  color: "bg-orange-500 hover:bg-orange-600", needsMachine: true  },
  in_dryer:     { action: "Mark Ready (No Fold)",   next: "ready",     color: "bg-green-600 hover:bg-green-700",   needsMachine: false },
}

const STATUS_LABEL: Record<string, string> = {
  pending:          "Pending",
  picked_up:        "Picked Up",
  at_facility:      "At Facility",
  in_washer:        "In Washer",
  in_dryer:         "In Dryer",
  folded:           "Folded",
  ready:            "Ready for Pickup",
  out_for_delivery: "Out for Delivery",
  delivered:        "Delivered",
}

const STATUS_COLOR: Record<string, string> = {
  pending:          "bg-gray-100 text-gray-500",
  picked_up:        "bg-blue-500 text-white",
  at_facility:      "bg-purple-100 text-purple-700",
  in_washer:        "bg-cyan-500 text-white",
  in_dryer:         "bg-orange-500 text-white",
  folded:           "bg-yellow-500 text-white",
  ready:            "bg-green-500 text-white",
  out_for_delivery: "bg-green-600 text-white",
  delivered:        "bg-[#0D2240] text-white",
}

const ALL_STATUSES = ["pending", "picked_up", "at_facility", "in_washer", "in_dryer", "folded", "ready", "out_for_delivery", "delivered"]
const CUSTOMER_MIN_LBS = 20
const DEFAULT_RATE_CENTS: Record<string, number> = {
  wash_fold:  250,
  wash_only:  199,
  comforter_wash: 0,
}

async function advanceBag(formData: FormData) {
  "use server"
  const bagId = formData.get("bagId") as string
  const bookingId = formData.get("bookingId") as string
  const nextStatus = formData.get("nextStatus") as string
  const machineId = formData.get("machineId") as string | null
  const operatorName = (formData.get("operatorName") as string) || "operator"
  const weightStr = formData.get("weight_lbs") as string | null
  const foldingNotes = (formData.get("folding_notes") as string | null)?.trim() || null

  const supabase = createAdminClient()

  // Weight entry: only for at_facility → in_washer on own_operator facilities
  if (nextStatus === "in_washer" && weightStr) {
    const { data: booking } = await supabase
      .from("bookings")
      .select("actual_weight_lbs, assigned_facility_id, pre_auth_cents, stripe_payment_intent_id, customer_final_cents")
      .eq("id", bookingId)
      .single()

    if (booking) {
      const weightLbs = parseFloat(weightStr)

      if (!booking.actual_weight_lbs && weightLbs > 0) {
        // First weight entry — calculate billing using locked-in rate
        const ratePerLbCents = (booking.price_per_lb_cents as number | null)
          ?? DEFAULT_RATE_CENTS[booking.service_type as string ?? "wash_fold"]
          ?? 250
        const customerChargeLbs = Math.max(weightLbs, CUSTOMER_MIN_LBS)
        const customerFinalCents = customerChargeLbs * ratePerLbCents

        let facilityCostCents = 0
        if (booking.assigned_facility_id) {
          const { data: facility } = await supabase
            .from("facilities")
            .select("rate_per_lb, minimum_lbs")
            .eq("id", booking.assigned_facility_id)
            .single()
          if (facility?.rate_per_lb) {
            const facilityLbs = Math.max(weightLbs, facility.minimum_lbs ?? 0)
            facilityCostCents = Math.round(facilityLbs * facility.rate_per_lb * 100)
          }
        }

        await supabase.from("bookings").update({
          actual_weight_lbs: weightLbs,
          customer_final_cents: customerFinalCents,
          facility_cost_cents: facilityCostCents,
          weight_entered_by: operatorName,
          weight_entered_at: new Date().toISOString(),
        }).eq("id", bookingId)

        if (booking.stripe_payment_intent_id && customerFinalCents) {
          try {
            const { capturePayment } = await import("@/app/actions/stripe")
            await capturePayment(bookingId)
          } catch (e) {
            console.error("[operator] Stripe capture failed:", e)
          }
        }

        await supabase.from("order_events").insert({
          booking_id: bookingId,
          bag_id: bagId,
          event_type: "weight_confirmed",
          notes: `Weight confirmed at washer loading: ${weightLbs} lbs → customer $${(customerFinalCents / 100).toFixed(2)}, facility $${(facilityCostCents / 100).toFixed(2)}`,
          created_by: operatorName,
        })
      } else if (booking.actual_weight_lbs) {
        await supabase.from("order_events").insert({
          booking_id: bookingId,
          bag_id: bagId,
          event_type: "weight_confirmed",
          notes: `Weight on file acknowledged at washer loading: ${booking.actual_weight_lbs} lbs`,
          created_by: operatorName,
        })
      }
    }
  }

  // Advance bag status
  await supabase.from("order_bags").update({ status: nextStatus }).eq("id", bagId)

  const eventMap: Record<string, string> = {
    in_washer: "bag_in_washer",
    in_dryer:  "bag_in_dryer",
    folded:    "bag_folded",
    ready:     "ready_for_delivery",
  }

  const eventNotes = foldingNotes
    ? foldingNotes
    : (machineId ? "Machine assigned" : null)

  await supabase.from("order_events").insert({
    booking_id: bookingId,
    bag_id: bagId,
    machine_id: machineId || null,
    event_type: eventMap[nextStatus] ?? nextStatus,
    notes: eventNotes,
    created_by: operatorName,
  })

  revalidatePath(`/operator/order/${bookingId}`)
}

async function completeOrderFolding(formData: FormData) {
  "use server"
  const bookingId       = formData.get("bookingId") as string
  const operatorName    = (formData.get("operatorName") as string) || "operator"
  const foldedCount     = formData.get("folded_count") as string
  const completionNotes = (formData.get("completion_notes") as string | null)?.trim() || null
  const foldedWeightLbs = parseFloat(formData.get("folded_weight_lbs") as string)

  const supabase = createAdminClient()

  // Fetch intake weight for discrepancy check
  const { data: bk } = await supabase
    .from("bookings")
    .select("actual_weight_lbs")
    .eq("id", bookingId)
    .single()

  const intakeWeight  = bk?.actual_weight_lbs ? parseFloat(String(bk.actual_weight_lbs)) : null
  const weightDiff    = (intakeWeight !== null && !isNaN(foldedWeightLbs))
    ? Math.abs(foldedWeightLbs - intakeWeight)
    : null
  const weightFlagged = weightDiff !== null && weightDiff >= 4

  // Save folded weight + flag on booking
  await supabase.from("bookings").update({
    folded_weight_lbs: !isNaN(foldedWeightLbs) ? foldedWeightLbs : null,
    ...(weightFlagged ? { notes: `⚠️ WEIGHT FLAG: Intake ${intakeWeight} lbs vs folded ${foldedWeightLbs} lbs (${weightDiff.toFixed(1)} lb difference). Verify no items missing.` } : {}),
  }).eq("id", bookingId)

  // Advance all folded bags to ready
  await supabase.from("order_bags")
    .update({ status: "ready" })
    .eq("booking_id", bookingId)
    .eq("status", "folded")

  const noteParts = [
    `${foldedCount} bag${parseInt(foldedCount) !== 1 ? "s" : ""} confirmed folded`,
    !isNaN(foldedWeightLbs) ? `Folded weight: ${foldedWeightLbs} lbs` : null,
    weightFlagged ? `⚠️ WEIGHT DISCREPANCY: ${weightDiff!.toFixed(1)} lbs vs intake — verify items` : null,
    completionNotes ? `Notes: ${completionNotes}` : null,
  ].filter(Boolean).join(" · ")

  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: weightFlagged ? "weight_discrepancy_flagged" : "order_folding_complete",
    notes: noteParts,
    created_by: operatorName,
  })

  revalidatePath(`/operator/order/${bookingId}`)
}

async function recordFoldingPhoto(formData: FormData) {
  "use server"
  const bookingId = formData.get("bookingId") as string
  const photoUrl = formData.get("photoUrl") as string

  const supabase = createAdminClient()
  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: "folding_photo",
    notes: photoUrl,
    created_by: "operator",
  })
}

export default async function OperatorOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: booking } = await supabase
    .from("bookings")
    .select(`
      *,
      assigned_facility:facilities!assigned_facility_id(id, name, processing_mode, rate_per_lb, minimum_lbs)
    `)
    .eq("id", id)
    .single()

  const isWashOnly = booking?.service_type === "wash_only"
  const OPERATOR_STEPS = isWashOnly ? OPERATOR_STEPS_WASH_ONLY : OPERATOR_STEPS_FULL
  if (!booking) notFound()

  const facility = booking.assigned_facility as {
    id: string; name: string; processing_mode: string
    rate_per_lb: number | null; minimum_lbs: number
  } | null

  const isPartnerMode = booking.facility_processing_mode === "partner_attendant"

  const { data: bags } = await supabase
    .from("order_bags")
    .select("*")
    .eq("booking_id", id)
    .order("bag_number")

  const { data: allFacilities } = await supabase
    .from("facilities")
    .select("id, name, machine_groups(id, name, type, machines(id, name, status))")
    .eq("active", true)
    .order("name")

  const orderCode = booking.id.slice(0, 8).toUpperCase()
  const allStatuses = bags?.map(b => b.status) ?? []
  const operatorDone = allStatuses.every(s => ["ready", "out_for_delivery", "delivered"].includes(s))
  const notArrived = allStatuses.every(s => ["pending", "picked_up"].includes(s))
  const isOwnOperator = !facility || facility.processing_mode === "own_operator"
  const weightOnFile   = booking.actual_weight_lbs as number | null
  const foldedWeight   = booking.folded_weight_lbs != null ? parseFloat(String(booking.folded_weight_lbs)) : null
  const weightDiff     = (weightOnFile && foldedWeight) ? Math.abs(foldedWeight - weightOnFile) : null
  const weightFlagged  = weightDiff !== null && weightDiff >= 4

  // Margin warning: facility minimum > actual weight
  const facilityMin = facility?.minimum_lbs ?? 0
  const showMarginWarning = weightOnFile && facilityMin > weightOnFile

  // Folding completion card: show when ALL bags are in "folded" state
  const allBagsAreFolded = !isWashOnly && bags && bags.length > 0 &&
    bags.every(b => b.status === "folded")

  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      {/* Header */}
      <div className="bg-[#0D2240] px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Link href="/operator" className="text-white/60 text-sm">← Orders</Link>
          <div className="text-center">
            <p className="text-white font-extrabold font-mono text-lg">{orderCode}</p>
            <p className="text-white/50 text-xs">{booking.customer_name}</p>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            operatorDone ? "bg-green-500 text-white" : "bg-white/10 text-white/70"
          }`}>
            {operatorDone ? "Done ✓" : `${allStatuses.filter(s => ["in_washer","in_dryer","folded","ready"].includes(s)).length}/${bags?.length ?? 0}`}
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Weight discrepancy flag */}
        {weightFlagged && (
          <div className="bg-red-600 rounded-2xl px-5 py-4 flex items-start gap-3">
            <span className="text-2xl shrink-0">🚨</span>
            <div>
              <p className="text-white font-extrabold text-base uppercase tracking-wide">Weight Discrepancy — Verify Items</p>
              <p className="text-white/80 text-sm mt-1">
                Intake: <span className="font-bold">{weightOnFile} lbs</span> · Folded: <span className="font-bold">{foldedWeight} lbs</span> · Difference: <span className="font-bold">{weightDiff!.toFixed(1)} lbs</span>
              </p>
              <p className="text-white/70 text-xs mt-1">
                A difference of 4+ lbs may indicate missing items. Check folding area and cart before releasing this order. Notify admin.
              </p>
            </div>
          </div>
        )}

        {/* Order summary + weight info */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
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
              <p className="text-gray-400 text-xs">Delivery</p>
              <p className="font-bold text-[#0D2240]">{booking.delivery_date}</p>
            </div>
          </div>

          {/* Facility + weight row */}
          {facility && (
            <div className="pt-3 border-t border-gray-50 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Facility</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-semibold text-[#0D2240] text-sm">{facility.name}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                    facility.processing_mode === "partner_attendant"
                      ? "bg-purple-50 text-purple-700 border border-purple-200"
                      : "bg-blue-50 text-blue-700 border border-blue-200"
                  }`}>
                    {facility.processing_mode === "partner_attendant" ? "Partner" : "Own Op"}
                  </span>
                </div>
                {facility.rate_per_lb && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    ${facility.rate_per_lb}/lb · min {facility.minimum_lbs ?? 0} lbs
                  </p>
                )}
              </div>
              {weightOnFile ? (
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Weight</p>
                  <p className="font-extrabold text-[#0D2240] text-lg">{weightOnFile} lbs</p>
                  <p className="text-[10px] text-gray-400">by {booking.weight_entered_by ?? "driver"}</p>
                </div>
              ) : (
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Weight</p>
                  <p className="text-sm text-amber-600 font-semibold">Not yet entered</p>
                </div>
              )}
            </div>
          )}

          {/* Billing summary (if weight set) */}
          {weightOnFile && booking.customer_final_cents && (
            <div className="pt-3 border-t border-gray-50 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <p className="text-gray-400">Customer charge</p>
                <p className="font-bold text-green-600">${(booking.customer_final_cents / 100).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-400">Facility cost</p>
                <p className="font-bold text-red-500">${((booking.facility_cost_cents ?? 0) / 100).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-400">Margin</p>
                <p className="font-bold text-[#0D2240]">
                  ${((booking.customer_final_cents - (booking.facility_cost_cents ?? 0)) / 100).toFixed(2)}
                </p>
              </div>
            </div>
          )}

          {/* Margin warning */}
          {showMarginWarning && (
            <div className="pt-2 border-t border-amber-100 bg-amber-50 -mx-4 -mb-4 px-4 pb-4 rounded-b-2xl">
              <p className="text-amber-700 text-xs font-semibold">
                ⚠️ Facility minimum ({facilityMin} lbs) exceeds actual weight ({weightOnFile} lbs).
                Facility billed at minimum — check margin.
              </p>
            </div>
          )}
        </div>

        {/* Partner attendant mode */}
        {isPartnerMode && (
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 text-center">
            <p className="text-purple-700 font-extrabold text-lg">🤝 Partner Attendant Order</p>
            <p className="text-purple-600 text-sm mt-1">
              This order is being processed by {facility?.name ?? "the partner facility"}.
              Use the partner portal to track progress — not this operator view.
            </p>
          </div>
        )}

        {/* Not arrived yet */}
        {notArrived && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center text-sm text-gray-400">
            🚐 Bags haven&apos;t arrived at the facility yet. Driver is still on pickup.
          </div>
        )}

        {/* All done */}
        {operatorDone && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
            <p className="text-green-700 font-extrabold text-lg">✅ All done!</p>
            <p className="text-green-600 text-sm mt-1">Bags are ready. Driver will collect for delivery.</p>
          </div>
        )}

        {/* ─── Folding Completion Card ─────────────────────────────────── */}
        {allBagsAreFolded && (
          <div className="bg-white rounded-2xl shadow-sm border-2 border-yellow-300 overflow-hidden">
            <div className="bg-yellow-400 px-4 py-3">
              <p className="font-extrabold text-[#0D2240] text-base">🧺 Folding Complete — Confirm & Finalize</p>
              <p className="text-[#0D2240]/70 text-xs mt-0.5">All bags are folded. Add a photo, confirm the count, then mark ready.</p>
            </div>
            <div className="p-4 space-y-4">
              {/* Photo uploader */}
              <PhotoUploader
                bookingId={booking.id}
                action={recordFoldingPhoto}
                label="📷 Folding Photos"
                emptyHint="Take a photo of the folded bags before packaging."
                compact
              />

              {/* Completion form */}
              <form action={completeOrderFolding} className="space-y-3">
                <input type="hidden" name="bookingId" value={booking.id} />

                {/* Folded weight — compared against intake weight */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                    Folded Weight (lbs) <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="folded_weight_lbs"
                    type="number"
                    step="0.1"
                    min="0.1"
                    placeholder="0.0"
                    required
                    className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] font-mono focus:outline-none focus:border-yellow-400"
                  />
                  {weightOnFile && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      Intake weight: <span className="font-bold text-gray-600">{weightOnFile} lbs</span>
                      {" "}· A difference of 4+ lbs will raise a flag
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                      Bags Folded *
                    </label>
                    <input
                      name="folded_count"
                      type="number"
                      min="1"
                      defaultValue={bags?.length ?? 1}
                      required
                      className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] font-mono focus:outline-none focus:border-yellow-400"
                    />
                    <p className="text-[10px] text-gray-300 mt-1">Expected: {bags?.length ?? 0}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                      Your Name
                    </label>
                    <input
                      name="operatorName"
                      type="text"
                      placeholder="Your name"
                      className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:border-yellow-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                    Notes (optional)
                  </label>
                  <textarea
                    name="completion_notes"
                    rows={2}
                    placeholder="Any issues? Missing items? Special instructions followed?"
                    className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:border-yellow-400 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-extrabold py-4 rounded-2xl text-base transition-colors"
                >
                  ✅ Mark All Ready for Pickup
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Bags */}
        {bags?.map((bag) => {
          const currentIdx = ALL_STATUSES.indexOf(bag.status)
          const step = OPERATOR_STEPS[bag.status]
          const isDone = ["ready", "out_for_delivery", "delivered"].includes(bag.status)
          const isDriverSide = ["pending", "picked_up"].includes(bag.status)

          const needsWeightEntry = bag.status === "at_facility" && isOwnOperator && !weightOnFile
          const weightAlreadySet = bag.status === "at_facility" && weightOnFile

          return (
            <div key={bag.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Bag header */}
              <div className="flex items-center gap-3 p-4 border-b border-gray-50">
                <div className="w-12 h-12 rounded-xl bg-[#0D2240] flex items-center justify-center shrink-0">
                  <span className="text-white font-extrabold text-lg font-mono">B{bag.bag_number}</span>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-[#0D2240] font-mono">{bag.label_code}</p>
                  <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mt-0.5 ${STATUS_COLOR[bag.status] ?? "bg-gray-100 text-gray-400"}`}>
                    {STATUS_LABEL[bag.status] ?? bag.status}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="px-4 py-2">
                <div className="flex gap-0.5">
                  {ALL_STATUSES.map((s, i) => (
                    <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${
                      i <= currentIdx
                        ? ["at_facility","in_washer","in_dryer","folded"].includes(s)
                          ? "bg-[#E8726A]"
                          : "bg-gray-300"
                        : "bg-gray-100"
                    }`} />
                  ))}
                </div>
                <div className="flex justify-between text-[8px] text-gray-300 mt-0.5 px-0.5">
                  <span>Driver</span>
                  <span>Operator</span>
                  <span>Driver</span>
                </div>
              </div>

              {/* Action */}
              <div className="p-4 pt-2">
                {isDone && (
                  <div className="text-center text-green-600 font-bold text-sm py-2">✅ Ready for pickup</div>
                )}
                {isDriverSide && (
                  <div className="text-center text-gray-400 font-medium text-sm py-2">
                    Waiting for driver drop-off
                  </div>
                )}

                {step && (
                  <form action={advanceBag} className="space-y-3">
                    <input type="hidden" name="bagId" value={bag.id} />
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <input type="hidden" name="nextStatus" value={step.next} />

                    {/* Weight entry */}
                    {needsWeightEntry && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <label className="block text-xs font-bold text-amber-700 uppercase tracking-wide mb-1.5">
                          ⚖️ Enter Weight (lbs) *
                        </label>
                        <input
                          name="weight_lbs"
                          type="number"
                          step="0.1"
                          min="0.1"
                          required
                          placeholder="e.g. 22.5"
                          className="w-full rounded-xl border-2 border-amber-300 px-3 py-2.5 text-sm text-[#0D2240] font-mono focus:outline-none focus:border-[#E8726A] bg-white"
                        />
                        <p className="text-[10px] text-amber-600 mt-1">
                          Customer billed at max(actual, 20 lbs) × $2.50/lb
                          {facility?.rate_per_lb && ` · Facility billed at max(actual, ${facility.minimum_lbs ?? 0} lbs) × $${facility.rate_per_lb}/lb`}
                        </p>
                      </div>
                    )}

                    {weightAlreadySet && (
                      <>
                        <input type="hidden" name="weight_lbs" value={String(weightOnFile)} />
                        <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-blue-700 font-semibold">
                          ⚖️ Weight on file: {weightOnFile} lbs (entered by {booking.weight_entered_by ?? "driver"})
                        </div>
                      </>
                    )}

                    {step.needsMachine && (
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                          {step.next === "in_washer" ? "Select Washer" : "Select Dryer"}
                        </label>
                        <select name="machineId" required
                          className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:border-[#E8726A]">
                          <option value="">— choose machine —</option>
                          {allFacilities?.map((fac) => {
                            const machineType = step.next === "in_washer" ? "washer" : "dryer"
                            const groups = (fac.machine_groups as Array<{
                              id: string; name: string; type: string
                              machines: Array<{ id: string; name: string; status: string }>
                            }>)?.filter(g => g.type === machineType) ?? []
                            if (groups.every(g => !g.machines?.length)) return null
                            return (
                              <optgroup key={fac.id} label={fac.name}>
                                {groups.flatMap(g =>
                                  g.machines?.filter(m => m.status === "active").map(m => (
                                    <option key={m.id} value={m.id}>{m.name} — {g.name}</option>
                                  )) ?? []
                                )}
                              </optgroup>
                            )
                          })}
                        </select>
                      </div>
                    )}

                    {/* Notes for folding step */}
                    {step.needsFoldingNotes && (
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                          Folding Notes (optional)
                        </label>
                        <textarea
                          name="folding_notes"
                          rows={2}
                          placeholder="Any issues with this bag? Items needing special attention?"
                          className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:border-[#E8726A] resize-none"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Your Name</label>
                      <input name="operatorName" type="text" placeholder="Your name"
                        className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:border-[#E8726A]" />
                    </div>

                    <button type="submit"
                      className={`w-full text-white font-extrabold py-4 rounded-2xl text-base transition-colors ${step.color}`}>
                      → {step.action}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
