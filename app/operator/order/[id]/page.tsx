import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import Link from "next/link"
import { revalidatePath } from "next/cache"
import PhotoUploader from "./photo-uploader"
import { WorkerNameInput } from "./worker-name-input"
import { FoldingForm } from "./folding-form"

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
  at_facility:      "bg-purple-100 text-purple-700",
  in_washer:        "bg-cyan-500 text-white",
  in_dryer:         "bg-orange-500 text-white",
  folded:           "bg-yellow-500 text-white",
  ready:            "bg-green-500 text-white",
  out_for_delivery: "bg-green-600 text-white",
  delivered:        "bg-[#0D2240] text-white",
  picked_up:        "bg-blue-500 text-white",
}

// Processing stages in order
const PROCESSING_STAGES = ["at_facility", "in_washer", "in_dryer", "folded", "ready"]
const PROCESSING_STAGES_WASH_ONLY = ["at_facility", "in_washer", "in_dryer", "ready"]

type StageConfig = {
  action: string
  next: string
  buttonColor: string
  needsMachines: boolean
  machineType?: "washer" | "dryer"
  needsOutputBags?: boolean
}

const STAGE_CONFIG: Record<string, StageConfig> = {
  at_facility: { action: "Load into Washer",    next: "in_washer", buttonColor: "bg-cyan-600 hover:bg-cyan-700",    needsMachines: true,  machineType: "washer" },
  in_washer:   { action: "Move to Dryer",       next: "in_dryer",  buttonColor: "bg-orange-500 hover:bg-orange-600", needsMachines: true,  machineType: "dryer" },
  in_dryer:    { action: "Done Drying — Fold",  next: "folded",    buttonColor: "bg-yellow-500 hover:bg-yellow-600", needsMachines: false },
  folded:      { action: "Mark Ready for Pickup",next: "ready",    buttonColor: "bg-green-600 hover:bg-green-700",   needsMachines: false, needsOutputBags: true },
}
const STAGE_CONFIG_WASH_ONLY: Record<string, StageConfig> = {
  at_facility: { action: "Load into Washer",    next: "in_washer", buttonColor: "bg-cyan-600 hover:bg-cyan-700",    needsMachines: true,  machineType: "washer" },
  in_washer:   { action: "Move to Dryer",       next: "in_dryer",  buttonColor: "bg-orange-500 hover:bg-orange-600", needsMachines: true,  machineType: "dryer" },
  in_dryer:    { action: "Mark Ready (No Fold)",next: "ready",     buttonColor: "bg-green-600 hover:bg-green-700",   needsMachines: false, needsOutputBags: true },
}

// ── Server actions ─────────────────────────────────────────────────────────────

async function advanceOrder(formData: FormData) {
  "use server"
  const bookingId    = formData.get("bookingId") as string
  const nextStatus   = formData.get("nextStatus") as string
  const operatorName = (formData.get("operatorName") as string) || "operator"
  const machineIds   = formData.getAll("machineId").filter(Boolean) as string[]
  const outputBags   = formData.get("output_bags") ? parseInt(formData.get("output_bags") as string) : null
  const weightStr    = formData.get("weight_lbs") as string | null

  const supabase = createAdminClient()

  // Handle weight entry if needed (first washer load)
  if (nextStatus === "in_washer" && weightStr) {
    const { data: booking } = await supabase
      .from("bookings")
      .select("actual_weight_lbs, assigned_facility_id, stripe_payment_intent_id, customer_final_cents, service_type")
      .eq("id", bookingId)
      .single()

    if (booking && !booking.actual_weight_lbs) {
      const weightLbs = parseFloat(weightStr)
      if (weightLbs > 0) {
        const DEFAULT_RATE: Record<string, number> = { wash_fold: 250, wash_only: 199, comforter_wash: 0 }
        const ratePerLbCents = DEFAULT_RATE[booking.service_type as string] ?? 250
        const customerChargeLbs = Math.max(weightLbs, 20)
        const customerFinalCents = customerChargeLbs * ratePerLbCents

        let facilityCostCents = 0
        if (booking.assigned_facility_id) {
          const { data: facility } = await supabase
            .from("facilities").select("rate_per_lb, minimum_lbs").eq("id", booking.assigned_facility_id).single()
          if (facility?.rate_per_lb) {
            facilityCostCents = Math.round(Math.max(weightLbs, facility.minimum_lbs ?? 0) * facility.rate_per_lb * 100)
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
          } catch (e) { console.error("[operator] Stripe capture failed:", e) }
        }
      }
    }
  }

  // Advance ALL bags to next status at once
  await supabase.from("order_bags").update({ status: nextStatus }).eq("booking_id", bookingId)

  // Save output bag count at folding/ready step
  if (outputBags && outputBags > 0) {
    await supabase.from("bookings").update({ output_bags: outputBags }).eq("id", bookingId)
  }

  // Log event with machine assignments
  const eventMap: Record<string, string> = {
    in_washer: "loaded_into_washer",
    in_dryer:  "moved_to_dryer",
    folded:    "drying_complete",
    ready:     "order_ready",
  }

  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: eventMap[nextStatus] ?? nextStatus,
    notes: [
      machineIds.length > 0 ? `Machines: ${machineIds.join(", ")}` : null,
      outputBags ? `Output bags: ${outputBags}` : null,
    ].filter(Boolean).join(" · ") || null,
    created_by: operatorName,
  })

  revalidatePath(`/operator/order/${bookingId}`)
}

async function setOrderStage(formData: FormData) {
  "use server"
  const bookingId  = formData.get("bookingId") as string
  const stage      = formData.get("stage") as string
  const operator   = (formData.get("operatorName") as string) || "operator"
  const supabase   = createAdminClient()
  await supabase.from("order_bags").update({ status: stage }).eq("booking_id", bookingId)
  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: "stage_reset",
    notes: `Reset to ${stage}`,
    created_by: operator,
  })
  revalidatePath(`/operator/order/${bookingId}`)
}

async function recordFoldingPhoto(formData: FormData) {
  "use server"
  const bookingId = formData.get("bookingId") as string
  const photoUrl  = formData.get("photoUrl") as string
  const supabase  = createAdminClient()
  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: "folding_photo",
    notes: photoUrl,
    created_by: "operator",
  })
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function OperatorOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: booking } = await supabase
    .from("bookings")
    .select(`*, assigned_facility:facilities!assigned_facility_id(id, name, processing_mode, rate_per_lb, minimum_lbs)`)
    .eq("id", id)
    .single()

  if (!booking) notFound()

  const isWashOnly = booking?.service_type === "wash_only"
  const stages     = isWashOnly ? PROCESSING_STAGES_WASH_ONLY : PROCESSING_STAGES
  const stageConf  = isWashOnly ? STAGE_CONFIG_WASH_ONLY : STAGE_CONFIG

  const facility = booking.assigned_facility as {
    id: string; name: string; processing_mode: string
    rate_per_lb: number | null; minimum_lbs: number
  } | null

  const isPartnerMode = booking.facility_processing_mode === "partner_attendant"

  const { data: bags } = await supabase
    .from("order_bags").select("*").eq("booking_id", id).order("bag_number")

  const { data: allFacilities } = await supabase
    .from("facilities")
    .select("id, name, machine_groups(id, name, type, machines(id, name, status))")
    .eq("active", true).order("name")

  const orderCode      = booking.id.slice(0, 8).toUpperCase()
  const pickupBagCount = bags?.length ?? booking.num_bags ?? 0
  const outputBagCount = booking.output_bags as number | null
  const weightOnFile   = booking.actual_weight_lbs as number | null
  const foldedWeight   = booking.folded_weight_lbs != null ? parseFloat(String(booking.folded_weight_lbs)) : null
  const weightDiff     = (weightOnFile && foldedWeight) ? Math.abs(foldedWeight - weightOnFile) : null
  const weightFlagged  = weightDiff !== null && weightDiff >= 4

  // Determine current processing stage from bags
  const allBagStatuses = bags?.map(b => b.status) ?? []
  const mostAdvancedStage = allBagStatuses.length > 0
    ? [...allBagStatuses].sort((a, z) => stages.indexOf(z) - stages.indexOf(a))[0]
    : (["picked_up", "confirmed"].includes(booking.status) ? "picked_up" : "at_facility")

  const currentStage = stages.includes(mostAdvancedStage) ? mostAdvancedStage : null
  const step         = currentStage ? stageConf[currentStage] : null
  const operatorDone = mostAdvancedStage === "ready" || allBagStatuses.every(s => ["ready","out_for_delivery","delivered"].includes(s))
  const notArrived   = ["confirmed","picked_up"].includes(booking.status) && allBagStatuses.every(s => ["pending","picked_up"].includes(s))
  const needsWeightEntry = currentStage === "at_facility" && (!facility || facility.processing_mode === "own_operator") && !weightOnFile

  // Collect machines by type
  type Machine = { id: string; name: string; groupName: string; facilityName: string }
  const washerMachines: Machine[] = []
  const dryerMachines: Machine[] = []
  allFacilities?.forEach(fac => {
    ;(fac.machine_groups as Array<{ id: string; name: string; type: string; machines: Array<{ id: string; name: string; status: string }> }>)
      ?.forEach(group => {
        group.machines?.filter(m => m.status === "active").forEach(m => {
          const entry = { id: m.id, name: m.name, groupName: group.name, facilityName: fac.name }
          if (group.type === "washer") washerMachines.push(entry)
          if (group.type === "dryer")  dryerMachines.push(entry)
        })
      })
  })
  const availableMachines = step?.machineType === "washer" ? washerMachines : dryerMachines

  const facilityMin       = facility?.minimum_lbs ?? 0
  const showMarginWarning = weightOnFile && facilityMin > weightOnFile

  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      {/* Header */}
      <div className="bg-[#0D2240] px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Link href="/operator" className="text-white/60 text-sm">← Orders</Link>
          <div className="text-center">
            <p className="text-white font-extrabold text-lg tracking-wide">{orderCode}</p>
            <p className="text-white/50 text-xs">{booking.customer_name}</p>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${operatorDone ? "bg-green-500 text-white" : "bg-white/10 text-white/70"}`}>
            {operatorDone ? "Done ✓" : (STATUS_LABEL[currentStage ?? ""] ?? "Processing")}
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Weight discrepancy flag */}
        {weightFlagged && (
          <div className="bg-red-600 rounded-2xl px-5 py-4 flex items-start gap-3">
            <span className="text-2xl shrink-0">🚨</span>
            <div>
              <p className="text-white font-extrabold text-base">Weight Discrepancy — Verify Items</p>
              <p className="text-white/80 text-sm mt-1">
                Intake: <b>{weightOnFile} lbs</b> · Folded: <b>{foldedWeight} lbs</b> · Diff: <b>{weightDiff!.toFixed(1)} lbs</b>
              </p>
            </div>
          </div>
        )}

        {/* Order summary */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Pickup Bags</p>
              <p className="text-4xl font-extrabold text-[#0D2240] leading-none mt-0.5">{pickupBagCount}</p>
              {outputBagCount && outputBagCount !== pickupBagCount && (
                <p className="text-xs text-green-600 font-semibold mt-1">→ {outputBagCount} delivery bags</p>
              )}
              {outputBagCount && outputBagCount === pickupBagCount && (
                <p className="text-xs text-gray-400 mt-1">→ {outputBagCount} delivery bags</p>
              )}
            </div>
            <div className="text-right space-y-1">
              <div>
                <p className="text-gray-400 text-xs">Service</p>
                <p className="font-semibold text-[#0D2240] text-sm">
                  {booking.service_type === "wash_fold" ? "Wash & Fold" : booking.service_type === "comforter_wash" ? "Comforter" : booking.service_type}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Need ready by</p>
                <p className="font-semibold text-[#0D2240] text-sm">{booking.delivery_date}</p>
              </div>
            </div>
          </div>

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
                  }`}>{facility.processing_mode === "partner_attendant" ? "Partner" : "Own Op"}</span>
                </div>
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

          {showMarginWarning && (
            <div className="pt-2 border-t border-amber-100 bg-amber-50 -mx-4 -mb-4 px-4 pb-4 rounded-b-2xl">
              <p className="text-amber-700 text-xs font-semibold">
                ⚠️ Facility minimum ({facilityMin} lbs) exceeds actual weight ({weightOnFile} lbs).
              </p>
            </div>
          )}
        </div>

        {/* Step chips — tappable to go back */}
        {!notArrived && (bags?.length ?? 0) > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Processing Stage</p>
            <div className="flex items-center gap-1 flex-wrap">
              {stages.map((stage, i) => {
                const stageIdx   = stages.indexOf(currentStage ?? "")
                const done       = stageIdx > i
                const isCurrent  = stage === currentStage
                const isPast     = done
                return (
                  <div key={stage} className="flex items-center gap-1">
                    {isPast ? (
                      <form action={setOrderStage}>
                        <input type="hidden" name="bookingId" value={booking.id} />
                        <input type="hidden" name="stage" value={stage} />
                        <WorkerNameInput name="operatorName" />
                        <button type="submit"
                          title={`Go back to ${STATUS_LABEL[stage]}`}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 hover:bg-amber-100 hover:text-amber-700 transition-colors cursor-pointer">
                          ✓ {STATUS_LABEL[stage]}
                        </button>
                      </form>
                    ) : (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                        isCurrent ? "bg-[#E8726A] text-white" : "bg-gray-100 text-gray-400"
                      }`}>
                        {isCurrent ? "▶ " : ""}{STATUS_LABEL[stage]}
                      </span>
                    )}
                    {i < stages.length - 1 && <span className="text-gray-200 text-[10px]">→</span>}
                  </div>
                )
              })}
            </div>
            {currentStage && stages.indexOf(currentStage) > 0 && (
              <p className="text-[10px] text-gray-300 mt-2">Tap a completed step to reset back to it (e.g. re-wash)</p>
            )}
          </div>
        )}

        {/* Partner mode */}
        {isPartnerMode && (
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 text-center">
            <p className="text-purple-700 font-extrabold text-lg">🤝 Partner Attendant Order</p>
            <p className="text-purple-600 text-sm mt-1">Processed by {facility?.name ?? "partner facility"}.</p>
          </div>
        )}

        {/* Not arrived */}
        {notArrived && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center text-sm text-gray-400">
            🚐 Bags haven&apos;t arrived at the facility yet. Driver is still on pickup.
          </div>
        )}

        {/* No bags registered */}
        {!notArrived && !operatorDone && !currentStage && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
            <p className="text-amber-700 font-bold">📦 No bags registered yet</p>
            <p className="text-amber-600 text-sm mt-1">
              Bags will appear here once scanned in. Status: <span className="font-bold capitalize">{booking.status?.replace(/_/g, " ")}</span>
            </p>
          </div>
        )}

        {/* Done */}
        {operatorDone && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
            <p className="text-green-700 font-extrabold text-lg">✅ All done!</p>
            <p className="text-green-600 text-sm mt-1">
              {outputBagCount ? `${outputBagCount} bags ready.` : "Bags are ready."} Driver will collect for delivery.
            </p>
          </div>
        )}

        {/* ── Main action card ── */}
        {!isPartnerMode && !notArrived && !operatorDone && step && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[currentStage!] ?? "bg-gray-100 text-gray-500"}`}>
                {STATUS_LABEL[currentStage!] ?? currentStage}
              </span>
              <span className="text-gray-400 text-xs">→ {step.action}</span>
            </div>

            <form action={advanceOrder} className="p-4 space-y-4">
              <input type="hidden" name="bookingId" value={booking.id} />
              <input type="hidden" name="nextStatus" value={step.next} />
              <WorkerNameInput name="operatorName" />

              {/* Weight fallback */}
              {needsWeightEntry && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400 whitespace-nowrap shrink-0">⚖️ Weight (lbs)</label>
                  <input name="weight_lbs" type="number" step="0.1" min="0.1" placeholder="e.g. 22.5"
                    className="w-28 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-[#0D2240] font-mono focus:outline-none focus:border-gray-400" />
                  <span className="text-[10px] text-gray-300">usually pre-filled by driver</span>
                </div>
              )}

              {/* Machine selection — checkboxes */}
              {step.needsMachines && availableMachines.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                    Select {step.machineType === "washer" ? "Washer(s)" : "Dryer(s)"} — pick all used
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {availableMachines.map(m => (
                      <label key={m.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 cursor-pointer hover:border-[#0D2240] has-[:checked]:border-[#E8726A] has-[:checked]:bg-[#E8726A]/5 transition-colors">
                        <input type="checkbox" name="machineId" value={m.id} className="accent-[#E8726A]" />
                        <div>
                          <p className="text-sm font-semibold text-[#0D2240]">{m.name}</p>
                          <p className="text-[10px] text-gray-400">{m.groupName}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {step.needsMachines && availableMachines.length === 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  ⚠️ No machines configured for this facility. Add machines in Admin → Logistics.
                </p>
              )}

              {/* Non-folding steps: normal submit */}
              {!step.needsOutputBags && (
                <button type="submit"
                  className={`w-full text-white font-extrabold py-4 rounded-2xl text-base transition-colors ${step.buttonColor}`}>
                  → {step.action}
                </button>
              )}
            </form>

            {/* Folding step: use client component that gates on photo */}
            {step.needsOutputBags && (
              <FoldingForm
                bookingId={booking.id}
                pickupBagCount={pickupBagCount}
                buttonColor={step.buttonColor}
                advanceOrder={advanceOrder}
                recordFoldingPhoto={recordFoldingPhoto}
              />
            )}
          </div>
        )}

        {/* Billing summary */}
        {weightOnFile && booking.customer_final_cents && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Billing</p>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <p className="text-gray-400">Customer</p>
                <p className="font-bold text-green-600">${(booking.customer_final_cents / 100).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-400">Facility cost</p>
                <p className="font-bold text-red-500">${((booking.facility_cost_cents ?? 0) / 100).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-400">Margin</p>
                <p className="font-bold text-[#0D2240]">${((booking.customer_final_cents - (booking.facility_cost_cents ?? 0)) / 100).toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
