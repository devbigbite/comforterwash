"use client"

import { useState, useEffect } from "react"
import PhotoUploader from "./photo-uploader"

interface Bag { id: string; bag_number: number; label_code: string; status: string }

interface Props {
  bookingId: string
  bags: Bag[]
  estimatedLbs: number
  allPending: boolean
  allPickedUp: boolean
  somePickedUp: boolean
  allAtWarehouse: boolean
  allAtFacility: boolean
  allReady: boolean
  allReadyAtWarehouse: boolean
  allOutForDel: boolean
  allDone: boolean
  pickupDate: string | null
  deliveryDate: string | null
  assignedFacilityName: string | null
  // server actions
  confirmPickup:    (fd: FormData) => Promise<void>
  confirmDropoff:   (fd: FormData) => Promise<void>
  confirmDelivery:  (fd: FormData) => Promise<void>
  recordPhotoEvent: (fd: FormData) => Promise<void>
}

const STORAGE_KEY = "washfold_driver_name"

function PhotoRequired({ taken, error }: { taken: boolean; error: boolean }) {
  if (taken) return <p className="text-green-600 text-xs font-semibold px-1 pt-1">✓ Photo taken</p>
  if (error) return <p className="text-red-500 text-xs font-semibold px-1 pt-1">⚠ Photo required before continuing</p>
  return null
}

export default function DriverOrderClient({
  bookingId, bags, estimatedLbs,
  allPending, allPickedUp, somePickedUp,
  allAtWarehouse, allAtFacility,
  allReady, allReadyAtWarehouse,
  allOutForDel, allDone,
  pickupDate, deliveryDate, assignedFacilityName,
  confirmPickup, confirmDropoff, confirmDelivery, recordPhotoEvent,
}: Props) {
  const today         = new Date().toISOString().split("T")[0]
  const isPickupDay   = pickupDate  === today
  const isDeliveryDay = deliveryDate === today

  const [driverName, setDriverName]       = useState("")
  const [nameError, setNameError]         = useState(false)
  const [submitting, setSubmitting]       = useState<string | null>(null)
  const [actualBagCount, setActualBagCount] = useState(bags.length)

  // Per-bag weights for dropoff
  const [bagWeights, setBagWeights]   = useState<string[]>(() => bags.map(() => ""))
  const totalWeight     = bagWeights.reduce((sum, w) => sum + (parseFloat(w) || 0), 0)
  const allSlotsWeighed = bagWeights.length > 0 && bagWeights.every(w => parseFloat(w) > 0)

  // Photo checkpoints
  const [hasCustomerPickupPhoto,   setHasCustomerPickupPhoto]   = useState(false)
  const [customerPickupPhotoErr,   setCustomerPickupPhotoErr]   = useState(false)
  const [hasWarehouseDropoffPhoto, setHasWarehouseDropoffPhoto] = useState(false)
  const [warehouseDropoffPhotoErr, setWarehouseDropoffPhotoErr] = useState(false)
  const [hasWarehousePickupPhoto,  setHasWarehousePickupPhoto]  = useState(false)
  const [warehousePickupPhotoErr,  setWarehousePickupPhotoErr]  = useState(false)
  const [hasDeliveryPhoto,         setHasDeliveryPhoto]         = useState(false)
  const [deliveryPhotoErr,         setDeliveryPhotoErr]         = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) setDriverName(saved)
  }, [])

  function saveName(n: string) {
    setDriverName(n)
    if (n.trim()) localStorage.setItem(STORAGE_KEY, n.trim())
    setNameError(false)
  }

  function requireName() {
    if (!driverName.trim()) { setNameError(true); return false }
    return true
  }

  function updateBagWeight(i: number, val: string) {
    setBagWeights(prev => { const next = [...prev]; next[i] = val; return next })
  }
  function addWeightSlot()        { setBagWeights(prev => [...prev, ""]) }
  function removeWeightSlot(i: number) { setBagWeights(prev => prev.filter((_, idx) => idx !== i)) }

  async function handlePickup() {
    let valid = requireName()
    if (!hasCustomerPickupPhoto) { setCustomerPickupPhotoErr(true); valid = false }
    if (!valid) return
    setSubmitting("pickup")
    const fd = new FormData()
    fd.append("bookingId",      bookingId)
    fd.append("driverName",     driverName.trim())
    fd.append("actualBagCount", String(actualBagCount))
    await confirmPickup(fd)
    setSubmitting(null)
  }

  async function handleDropoff(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!requireName()) return
    if (!hasWarehouseDropoffPhoto) { setWarehouseDropoffPhotoErr(true); return }
    if (!allSlotsWeighed || totalWeight <= 0) return
    setSubmitting("dropoff")
    const fd = new FormData(e.currentTarget)
    fd.set("driverName", driverName.trim())
    fd.set("weightLbs",  totalWeight.toFixed(1))
    await confirmDropoff(fd)
    setSubmitting(null)
  }

  async function handleDeliveryStart() {
    if (!requireName()) return
    if (!hasWarehousePickupPhoto) { setWarehousePickupPhotoErr(true); return }
    setSubmitting("start")
    const fd = new FormData()
    fd.append("bookingId",   bookingId)
    fd.append("driverName",  driverName.trim())
    fd.append("nextStatus",  "out_for_delivery")
    await confirmDelivery(fd)
    setSubmitting(null)
  }

  async function handleDelivered() {
    if (!requireName()) return
    if (!hasDeliveryPhoto) { setDeliveryPhotoErr(true); return }
    setSubmitting("delivered")
    const fd = new FormData()
    fd.append("bookingId",  bookingId)
    fd.append("driverName", driverName.trim())
    fd.append("nextStatus", "delivered")
    await confirmDelivery(fd)
    setSubmitting(null)
  }

  // Phase logic
  const inPickupFlow   = allPending || somePickedUp || (allPickedUp && !allAtWarehouse)
  const inDeliveryFlow = allReadyAtWarehouse || allOutForDel
  const showPickup     = inPickupFlow   && !isDeliveryDay
  const showDelivery   = inDeliveryFlow && !isPickupDay

  // Banner
  const todayBanner =
    isPickupDay     ? { label: "Today: Pickup",     sub: `Weigh + drop at warehouse · delivery ${deliveryDate}`,      bg: "bg-[#E8726A]", icon: "📦" }
  : isDeliveryDay   ? { label: "Today: Delivery",   sub: "Collect clean bags from warehouse · return to customer",     bg: "bg-[#0D2240]", icon: "🚐" }
  : inPickupFlow    ? { label: "Pickup in progress",sub: "Complete warehouse drop-off",                                bg: "bg-orange-500", icon: "⏳" }
  : allAtWarehouse  ? { label: "At Warehouse",      sub: "Waiting for transport run to assign to facility",            bg: "bg-amber-500",  icon: "🏪" }
  : allAtFacility && !allReady
                    ? { label: "Being Processed",   sub: `At facility${assignedFacilityName ? ` (${assignedFacilityName})` : ""} · delivery ${deliveryDate}`, bg: "bg-purple-600", icon: "🏭" }
  : allReady && !allReadyAtWarehouse
                    ? { label: "Ready at Facility", sub: "Awaiting return transport run to warehouse",                 bg: "bg-green-600",  icon: "✅" }
  : null

  return (
    <div className="space-y-4">

      {/* ── Banner ── */}
      {todayBanner && !allDone && (
        <div className={`${todayBanner.bg} rounded-2xl px-5 py-3 flex items-center gap-3`}>
          <span className="text-2xl">{todayBanner.icon}</span>
          <div>
            <p className="text-white font-extrabold text-base uppercase tracking-wide">{todayBanner.label}</p>
            <p className="text-white/70 text-xs">{todayBanner.sub}</p>
          </div>
        </div>
      )}

      {/* ── Driver name ── */}
      <div className={`bg-white rounded-2xl shadow-sm border p-4 ${nameError ? "border-red-400" : "border-gray-100"}`}>
        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
          Your Name <span className="text-[#E8726A]">*</span>
        </label>
        <input
          type="text" value={driverName} onChange={e => saveName(e.target.value)}
          placeholder="Enter your name"
          className={`w-full rounded-xl border-2 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none transition-colors
            ${nameError ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-[#E8726A]"}`}
        />
        {nameError && <p className="text-red-500 text-xs mt-1 font-semibold">⚠ Name is required</p>}
        {driverName && !nameError && <p className="text-green-600 text-xs mt-1">✓ Saved for this device</p>}
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* PICKUP PHASE                                                   */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {showPickup && (
        <div className="rounded-2xl overflow-hidden border-2 border-[#E8726A]">
          <div className="bg-[#E8726A] px-5 py-3 flex items-center gap-3">
            <span className="text-2xl">📦</span>
            <div>
              <p className="text-white font-extrabold text-base uppercase tracking-wide">Pickup Phase</p>
              <p className="text-white/80 text-xs">Collect bags from customer · weigh · drop at warehouse</p>
            </div>
          </div>

          <div className="bg-white p-5 space-y-5">

            {/* Step 1: Collect from customer */}
            {allPending && (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-extrabold text-[#0D2240] mb-0.5">Step 1 — Collect from customer</p>
                  <p className="text-xs text-gray-500">Label all {bags.length} bag{bags.length !== 1 ? "s" : ""}, take a photo, then confirm.</p>
                </div>
                <div className={`rounded-xl overflow-hidden border-2 ${customerPickupPhotoErr ? "border-red-400" : hasCustomerPickupPhoto ? "border-green-400" : "border-gray-200"}`}>
                  <PhotoUploader bookingId={bookingId} action={recordPhotoEvent}
                    eventType="photo_customer_pickup" label="📷 Photo at Customer"
                    onPhotoUploaded={() => { setHasCustomerPickupPhoto(true); setCustomerPickupPhotoErr(false) }} />
                  <PhotoRequired taken={hasCustomerPickupPhoto} error={customerPickupPhotoErr} />
                </div>

                {/* Bag count confirmation */}
                <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">
                    Actual Bag Count <span className="text-[#E8726A]">*</span>
                  </p>
                  <div className="flex items-center justify-between gap-4">
                    <button type="button"
                      onClick={() => setActualBagCount(c => Math.max(1, c - 1))}
                      className="w-12 h-12 rounded-xl bg-white border-2 border-gray-200 hover:border-[#E8726A] text-[#0D2240] font-extrabold text-2xl flex items-center justify-center transition-colors">
                      −
                    </button>
                    <div className="flex-1 text-center">
                      <p className="text-4xl font-black text-[#0D2240] font-mono leading-none">{actualBagCount}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {actualBagCount === bags.length
                          ? "matches booking"
                          : actualBagCount > bags.length
                            ? <span className="text-amber-600 font-semibold">+{actualBagCount - bags.length} extra vs booking</span>
                            : <span className="text-red-500 font-semibold">{bags.length - actualBagCount} fewer than booked</span>}
                      </p>
                    </div>
                    <button type="button"
                      onClick={() => setActualBagCount(c => c + 1)}
                      className="w-12 h-12 rounded-xl bg-white border-2 border-gray-200 hover:border-[#E8726A] text-[#0D2240] font-extrabold text-2xl flex items-center justify-center transition-colors">
                      +
                    </button>
                  </div>
                </div>

                <button onClick={handlePickup} disabled={submitting === "pickup"}
                  className="w-full bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl text-base transition-colors">
                  {submitting === "pickup" ? "Confirming…" : `📦 Confirm Pickup of ${actualBagCount} Bag${actualBagCount !== 1 ? "s" : ""}`}
                </button>
              </div>
            )}

            {/* Step 2: Weigh + drop at warehouse */}
            {(allPickedUp || somePickedUp) && !allAtWarehouse && (
              <form onSubmit={handleDropoff} className="space-y-4">
                <div>
                  <p className="text-sm font-extrabold text-[#0D2240] mb-0.5">Step 2 — Weigh &amp; drop at warehouse</p>
                  <p className="text-xs text-gray-500">Weigh each bag at the warehouse scale, take a photo, then confirm.</p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
                  <span className="text-lg shrink-0">🏪</span>
                  <div>
                    <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Drop-off: WashFold Warehouse</p>
                    <p className="text-xs text-amber-700 mt-0.5">Leave bags here — a transport run will move them to the laundry facility.</p>
                  </div>
                </div>

                <div className={`rounded-xl overflow-hidden border-2 ${warehouseDropoffPhotoErr ? "border-red-400" : hasWarehouseDropoffPhoto ? "border-green-400" : "border-gray-200"}`}>
                  <PhotoUploader bookingId={bookingId} action={recordPhotoEvent}
                    eventType="photo_facility_dropoff" label="📷 Photo at Warehouse"
                    onPhotoUploaded={() => { setHasWarehouseDropoffPhoto(true); setWarehouseDropoffPhotoErr(false) }} />
                  <PhotoRequired taken={hasWarehouseDropoffPhoto} error={warehouseDropoffPhotoErr} />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                    Bag Weights (lbs) <span className="text-[#E8726A]">*</span>
                  </label>
                  <div className="space-y-2">
                    {bagWeights.map((w, i) => {
                      const isPrimary = i < bags.length
                      const hasValue  = parseFloat(w) > 0
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span className={`w-14 shrink-0 text-xs font-bold uppercase tracking-wide ${isPrimary ? "text-gray-600" : "text-[#E8726A]"}`}>
                            {isPrimary ? `Bag ${i + 1}` : `Extra ${i - bags.length + 1}`}
                          </span>
                          <input type="number" step="0.1" min="0.1" value={w}
                            onChange={e => updateBagWeight(i, e.target.value)} placeholder="0.0"
                            className={`flex-1 rounded-xl border-2 px-3 py-2.5 text-center text-xl font-bold font-mono text-[#0D2240] focus:outline-none transition-colors
                              ${hasValue ? "border-green-400 bg-green-50" : "border-gray-200 focus:border-[#E8726A]"}`} />
                          <span className="shrink-0 text-sm font-semibold text-gray-500">lbs</span>
                          {!isPrimary && (
                            <button type="button" onClick={() => removeWeightSlot(i)}
                              className="shrink-0 w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 font-bold text-sm flex items-center justify-center">✕</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <button type="button" onClick={addWeightSlot}
                    className="w-full mt-1 py-2.5 rounded-xl border-2 border-dashed border-gray-200 hover:border-[#E8726A] hover:bg-orange-50 text-gray-500 hover:text-[#E8726A] text-sm font-bold transition-colors">
                    + Add weight
                  </button>
                  <div className={`mt-3 rounded-xl px-4 py-3 flex items-center justify-between ${allSlotsWeighed && totalWeight > 0 ? "bg-[#0D2240]" : "bg-gray-100"}`}>
                    <span className={`text-sm font-bold ${allSlotsWeighed && totalWeight > 0 ? "text-white/70" : "text-gray-400"}`}>Total</span>
                    <span className={`text-2xl font-black font-mono ${allSlotsWeighed && totalWeight > 0 ? "text-[#E8726A]" : "text-gray-300"}`}>
                      {totalWeight > 0 ? `${totalWeight.toFixed(1)} lbs` : "— lbs"}
                    </span>
                  </div>
                  <input type="hidden" name="bookingId" value={bookingId} />
                  <input type="hidden" name="weightLbs" value={totalWeight.toFixed(1)} />
                </div>

                <button type="submit" disabled={submitting === "dropoff" || !allSlotsWeighed || totalWeight <= 0}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl text-base transition-colors">
                  {submitting === "dropoff" ? "Saving…" : `🏪 Confirm Warehouse Drop-off · ${totalWeight > 0 ? totalWeight.toFixed(1) + " lbs" : "enter weights"}`}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Waiting states ── */}
      {allAtWarehouse && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 text-center">
          <p className="text-amber-700 font-extrabold text-lg">🏪 At Warehouse</p>
          <p className="text-amber-600 text-sm mt-1">Bags are at the warehouse. A transport run will move them to the laundry facility.</p>
          {deliveryDate && <p className="text-amber-500 text-xs mt-2">Scheduled delivery: {deliveryDate}</p>}
        </div>
      )}

      {allAtFacility && !allReady && (
        <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-5 text-center">
          <p className="text-purple-700 font-extrabold text-lg">🏭 Being Processed</p>
          <p className="text-purple-600 text-sm mt-1">
            Washing, drying &amp; folding{assignedFacilityName ? ` at ${assignedFacilityName}` : ""}.
          </p>
          {deliveryDate && <p className="text-purple-500 text-xs mt-2">Scheduled delivery: {deliveryDate}</p>}
        </div>
      )}

      {allReady && !allReadyAtWarehouse && (
        <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-5 text-center">
          <p className="text-green-700 font-extrabold text-lg">✅ Ready at Facility</p>
          <p className="text-green-600 text-sm mt-1">Bags are clean. Awaiting return transport run to warehouse.</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* DELIVERY PHASE                                                 */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {showDelivery && (
        <div className="rounded-2xl overflow-hidden border-2 border-[#0D2240]">
          <div className="bg-[#0D2240] px-5 py-3 flex items-center gap-3">
            <span className="text-2xl">🚐</span>
            <div>
              <p className="text-white font-extrabold text-base uppercase tracking-wide">Delivery Phase</p>
              <p className="text-white/70 text-xs">Collect clean bags from warehouse · deliver to customer</p>
            </div>
          </div>

          <div className="bg-white p-5 space-y-5">

            {/* Step 1: Pick up from warehouse */}
            {allReadyAtWarehouse && (
              <div className="space-y-3">
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-center">
                  <p className="text-teal-700 font-extrabold">✅ Bags ready at warehouse!</p>
                  <p className="text-teal-600 text-sm mt-0.5">Go to the warehouse and collect the clean bags.</p>
                </div>
                <div>
                  <p className="text-sm font-extrabold text-[#0D2240] mb-0.5">Step 1 — Collect from warehouse</p>
                  <p className="text-xs text-gray-500">Take a photo of the clean bags at the warehouse, then start the delivery run.</p>
                </div>
                <div className={`rounded-xl overflow-hidden border-2 ${warehousePickupPhotoErr ? "border-red-400" : hasWarehousePickupPhoto ? "border-green-400" : "border-gray-200"}`}>
                  <PhotoUploader bookingId={bookingId} action={recordPhotoEvent}
                    eventType="photo_facility_pickup" label="📷 Photo at Warehouse — Clean Bags"
                    onPhotoUploaded={() => { setHasWarehousePickupPhoto(true); setWarehousePickupPhotoErr(false) }} />
                  <PhotoRequired taken={hasWarehousePickupPhoto} error={warehousePickupPhotoErr} />
                </div>
                <button onClick={handleDeliveryStart} disabled={submitting === "start"}
                  className="w-full bg-[#0D2240] hover:bg-[#1a3a5c] disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl text-base transition-colors">
                  {submitting === "start" ? "Starting…" : "🚐 Start Delivery Run"}
                </button>
              </div>
            )}

            {/* Step 2: Deliver to customer */}
            {allOutForDel && (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                  <p className="text-blue-700 font-extrabold">🚐 Out for delivery</p>
                  <p className="text-blue-600 text-sm mt-0.5">Head to the customer and hand over the clean bags.</p>
                </div>
                <div>
                  <p className="text-sm font-extrabold text-[#0D2240] mb-0.5">Step 2 — Deliver to customer</p>
                  <p className="text-xs text-gray-500">Take a photo at the customer's door, then confirm delivery.</p>
                </div>
                <div className={`rounded-xl overflow-hidden border-2 ${deliveryPhotoErr ? "border-red-400" : hasDeliveryPhoto ? "border-green-400" : "border-gray-200"}`}>
                  <PhotoUploader bookingId={bookingId} action={recordPhotoEvent}
                    eventType="photo_customer_delivery" label="📷 Photo at Customer — Delivery"
                    onPhotoUploaded={() => { setHasDeliveryPhoto(true); setDeliveryPhotoErr(false) }} />
                  <PhotoRequired taken={hasDeliveryPhoto} error={deliveryPhotoErr} />
                </div>
                <button onClick={handleDelivered} disabled={submitting === "delivered"}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl text-base transition-colors">
                  {submitting === "delivered" ? "Confirming…" : "🎉 Confirm Delivered to Customer"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {allDone && (
        <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-6 text-center">
          <p className="text-green-700 font-extrabold text-xl">🎉 Order Complete</p>
          <p className="text-green-600 text-sm mt-1">All bags delivered successfully.</p>
        </div>
      )}
    </div>
  )
}
