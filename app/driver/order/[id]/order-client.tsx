"use client"

import { useState, useEffect } from "react"
import PhotoUploader from "./photo-uploader"

interface Bag { id: string; bag_number: number; label_code: string; status: string }

const COLORS = [
  { key: "red",     label: "Red",      hex: "#ef4444" },
  { key: "blue",    label: "Blue",     hex: "#3b82f6" },
  { key: "sky",     label: "Sky Blue", hex: "#38bdf8" },
  { key: "green",   label: "Green",    hex: "#22c55e" },
  { key: "lime",    label: "Lime",     hex: "#84cc16" },
  { key: "pink",    label: "Pink",     hex: "#f472b6" },
  { key: "hotpink", label: "Hot Pink", hex: "#ec4899" },
  { key: "orange",  label: "Orange",   hex: "#f97316" },
  { key: "yellow",  label: "Yellow",   hex: "#eab308" },
  { key: "purple",  label: "Purple",   hex: "#a855f7" },
]

interface Props {
  bookingId: string
  bags: Bag[]
  estimatedLbs: number
  takenColors?: string[]
  existingColorKey?: string | null
  dropoffLocation?: "warehouse" | "facility"
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

const SESSION_KEY = "washfold_driver_worker"

function PhotoRequired({ taken, error }: { taken: boolean; error: boolean }) {
  if (taken) return <p className="text-green-600 text-sm font-semibold px-1 pt-1">✓ Photo taken</p>
  if (error) return <p className="text-red-500 text-sm font-semibold px-1 pt-1">⚠ Photo required before continuing</p>
  return null
}

export default function DriverOrderClient({
  bookingId, bags, estimatedLbs,
  takenColors = [], existingColorKey,
  dropoffLocation = "warehouse",
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

  const [driverName, setDriverName]         = useState("")
  const [submitting, setSubmitting]         = useState<string | null>(null)
  const [actualBagCount, setActualBagCount] = useState(bags.length)
  const [selectedColor, setSelectedColor]   = useState<string>(existingColorKey ?? "")
  const [colorError, setColorError]         = useState(false)

  // Per-bag weights for dropoff
  const [bagWeights, setBagWeights]   = useState<string[]>(() => bags.map(() => ""))
  const totalWeight     = bagWeights.reduce((sum, w) => sum + (parseFloat(w) || 0), 0)
  const allSlotsWeighed = bagWeights.length > 0 && bagWeights.every(w => parseFloat(w) > 0)

  // Photo checkpoints
  const [weightError, setWeightError] = useState(false)

  const [hasCustomerPickupPhoto,   setHasCustomerPickupPhoto]   = useState(false)
  const [customerPickupPhotoErr,   setCustomerPickupPhotoErr]   = useState(false)
  const [hasWarehouseDropoffPhoto, setHasWarehouseDropoffPhoto] = useState(false)
  const [warehouseDropoffPhotoErr, setWarehouseDropoffPhotoErr] = useState(false)
  const [floorPhotoUrl,            setFloorPhotoUrl]            = useState<string | null>(null)
  const [hasWarehousePickupPhoto,  setHasWarehousePickupPhoto]  = useState(false)
  const [warehousePickupPhotoErr,  setWarehousePickupPhotoErr]  = useState(false)
  const [hasDeliveryPhoto,         setHasDeliveryPhoto]         = useState(false)
  const [deliveryPhotoErr,         setDeliveryPhotoErr]         = useState(false)

  // Auto-init: color from available pool, name from clock-in session
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (raw) {
        const s = JSON.parse(raw)
        if (s?.workerName) setDriverName(s.workerName)
      }
    } catch {}
    // Auto-assign color if none pre-assigned
    if (!existingColorKey) {
      const available = COLORS.filter(c => !takenColors.includes(c.key))
      if (available.length > 0) {
        const pick = available[Math.floor(Math.random() * available.length)]
        setSelectedColor(pick.key)
      }
    }
  }, [])

  function requireName() {
    return true  // name comes from session, always present
  }

  function updateBagWeight(i: number, val: string) {
    setBagWeights(prev => { const next = [...prev]; next[i] = val; return next })
  }
  function addWeightSlot()        { setBagWeights(prev => [...prev, ""]) }
  function removeWeightSlot(i: number) { setBagWeights(prev => prev.filter((_, idx) => idx !== i)) }

  async function handlePickup() {
    let valid = requireName()
    if (!hasCustomerPickupPhoto) { setCustomerPickupPhotoErr(true); valid = false }
    if (!selectedColor) { setColorError(true); valid = false }
    if (!valid) return
    setSubmitting("pickup")
    const fd = new FormData()
    fd.append("bookingId",      bookingId)
    fd.append("driverName",     driverName.trim())
    fd.append("actualBagCount", String(actualBagCount))
    fd.append("colorKey",       selectedColor)
    await confirmPickup(fd)
    setSubmitting(null)
  }

  async function handleDropoff(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    let valid = requireName()
    if (!hasWarehouseDropoffPhoto) { setWarehouseDropoffPhotoErr(true); valid = false }
    if (!allSlotsWeighed || totalWeight <= 0) { setWeightError(true); valid = false }
    if (!valid) return
    setWeightError(false)
    setSubmitting("dropoff")
    const fd = new FormData(e.currentTarget)
    fd.set("driverName",       driverName.trim())
    fd.set("weightLbs",        totalWeight.toFixed(1))
    fd.set("dropoffLocation",  dropoffLocation)
    if (floorPhotoUrl) fd.set("floorPhotoUrl", floorPhotoUrl)
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
            <p className="text-white font-extrabold text-lg uppercase tracking-wide">{todayBanner.label}</p>
            <p className="text-white/70 text-sm">{todayBanner.sub}</p>
          </div>
        </div>
      )}

      {/* Driver name read from session — no input needed */}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* PICKUP PHASE                                                   */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {showPickup && (
        <div className="rounded-2xl overflow-hidden border-2 border-[#E8726A]">
          <div className="bg-[#E8726A] px-5 py-3 flex items-center gap-3">
            <span className="text-2xl">📦</span>
            <div>
              <p className="text-white font-extrabold text-lg uppercase tracking-wide">Pickup Phase</p>
              <p className="text-white/80 text-sm">Collect bags from customer · weigh · drop at warehouse</p>
            </div>
          </div>

          <div className="bg-white p-5 space-y-5">

            {/* Step 1: Collect from customer */}
            {allPending && (
              <div className="space-y-3">
                <div>
                  <p className="text-base font-extrabold text-[#0D2240] mb-0.5">Step 1 — Collect from customer</p>
                  <p className="text-sm text-gray-500">Label all {bags.length} bag{bags.length !== 1 ? "s" : ""}, take a photo, then confirm.</p>
                </div>
                <div className={`rounded-xl overflow-hidden border-2 ${customerPickupPhotoErr ? "border-red-400" : hasCustomerPickupPhoto ? "border-green-400" : "border-gray-200"}`}>
                  <PhotoUploader bookingId={bookingId} action={recordPhotoEvent}
                    eventType="photo_customer_pickup" label="📷 Photo at Customer"
                    onPhotoUploaded={() => { setHasCustomerPickupPhoto(true); setCustomerPickupPhotoErr(false) }} />
                  <PhotoRequired taken={hasCustomerPickupPhoto} error={customerPickupPhotoErr} />
                </div>

                {/* Color key — pre-assigned, driver just matches */}
                {(() => {
                  const color = COLORS.find(c => c.key === selectedColor)
                  if (!color) return (
                    <div className="rounded-xl p-4 border-2 border-red-400 bg-red-50">
                      <p className="text-sm font-bold text-red-600 uppercase tracking-wide">⚠ No color assigned</p>
                      <p className="text-sm text-red-500 mt-1">Contact dispatch — this order has no color key assigned.</p>
                    </div>
                  )
                  return (
                    <div className="rounded-xl overflow-hidden border-2 border-gray-200">
                      {/* Header */}
                      <div className="px-4 pt-4 pb-3" style={{ background: color.hex + "18" }}>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Color Key Sticker</p>
                        {/* Big swatch + label */}
                        <div className="flex items-center gap-4">
                          <span className="w-16 h-16 rounded-2xl shadow-md ring-4 ring-white shrink-0"
                            style={{ background: color.hex }} />
                          <div>
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Use the</p>
                            <p className="font-black text-[#0D2240] leading-none" style={{ fontSize: "clamp(1.6rem, 7vw, 2.2rem)" }}>
                              {color.label.toUpperCase()}
                            </p>
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">sticker</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-gray-50 px-4 py-2.5 border-t border-gray-100">
                        <p className="text-sm text-gray-500">
                          Apply <span className="font-bold" style={{ color: color.hex }}>{color.label}</span> stickers to all {bags.length} bag{bags.length !== 1 ? "s" : ""} in this order. Each order uses a unique color.
                        </p>
                      </div>
                    </div>
                  )
                })()}

                {/* Bag count confirmation */}
                <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">
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
                      <p className="text-sm text-gray-500 mt-1">
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
                  className="w-full bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl text-lg transition-colors">
                  {submitting === "pickup" ? "Confirming…" : `📦 Confirm Pickup of ${actualBagCount} Bag${actualBagCount !== 1 ? "s" : ""}`}
                </button>
              </div>
            )}

            {/* Step 2: Weigh + drop */}
            {(allPickedUp || somePickedUp) && !allAtWarehouse && !allAtFacility && (
              <form onSubmit={handleDropoff} className="space-y-4">
                <div>
                  <p className="text-base font-extrabold text-[#0D2240] mb-0.5">
                    Step 2 — Weigh &amp; drop at {dropoffLocation === "facility" ? "facility" : "warehouse"}
                  </p>
                  <p className="text-sm text-gray-500">
                    Weigh each bag, take a photo showing where you placed them, then confirm. <span className="font-bold text-[#E8726A]">Weighing is required.</span>
                  </p>
                </div>

                <div className={`rounded-xl px-4 py-3 flex items-start gap-2 ${dropoffLocation === "facility" ? "bg-purple-50 border border-purple-200" : "bg-amber-50 border border-amber-200"}`}>
                  <span className="text-xl shrink-0">{dropoffLocation === "facility" ? "🏭" : "🏪"}</span>
                  <div>
                    <p className={`text-sm font-bold uppercase tracking-wide ${dropoffLocation === "facility" ? "text-purple-800" : "text-amber-800"}`}>
                      Drop-off: {dropoffLocation === "facility" ? "Laundry Facility" : "WashFold Warehouse"}
                    </p>
                    <p className={`text-sm mt-0.5 ${dropoffLocation === "facility" ? "text-purple-700" : "text-amber-700"}`}>
                      {dropoffLocation === "facility"
                        ? "Leave bags at the facility — processing starts here."
                        : "Leave bags here — a transport run will move them to the laundry facility."}
                    </p>
                  </div>
                </div>

                {/* Floor photo — internal only */}
                <div className={`rounded-xl overflow-hidden border-2 ${warehouseDropoffPhotoErr ? "border-red-400" : hasWarehouseDropoffPhoto ? "border-green-400" : "border-gray-200"}`}>
                  <PhotoUploader bookingId={bookingId} action={recordPhotoEvent}
                    eventType="photo_facility_dropoff"
                    label={`📷 Photo — where you placed the bags (internal)`}
                    onPhotoUploaded={(url?: string) => {
                      setHasWarehouseDropoffPhoto(true)
                      setWarehouseDropoffPhotoErr(false)
                      if (url) setFloorPhotoUrl(url)
                    }} />
                  <PhotoRequired taken={hasWarehouseDropoffPhoto} error={warehouseDropoffPhotoErr} />
                  {hasWarehouseDropoffPhoto && (
                    <p className="text-[10px] text-gray-400 px-3 pb-2">🔒 Internal only — not visible to customer</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-600 uppercase tracking-wide mb-2">
                    Bag Weights (lbs) <span className="text-[#E8726A]">*</span>
                  </label>
                  <div className="space-y-2">
                    {bagWeights.map((w, i) => {
                      const isPrimary = i < bags.length
                      const hasValue  = parseFloat(w) > 0
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span className={`w-14 shrink-0 text-sm font-bold uppercase tracking-wide ${isPrimary ? "text-gray-600" : "text-[#E8726A]"}`}>
                            {isPrimary ? `Bag ${i + 1}` : `Extra ${i - bags.length + 1}`}
                          </span>
                          <input type="number" step="0.1" min="0.1" value={w}
                            onChange={e => updateBagWeight(i, e.target.value)} placeholder="0.0"
                            className={`flex-1 rounded-xl border-2 px-3 py-2.5 text-center text-2xl font-bold font-mono text-[#0D2240] focus:outline-none transition-colors
                              ${hasValue ? "border-green-400 bg-green-50" : "border-gray-200 focus:border-[#E8726A]"}`} />
                          <span className="shrink-0 text-base font-semibold text-gray-500">lbs</span>
                          {!isPrimary && (
                            <button type="button" onClick={() => removeWeightSlot(i)}
                              className="shrink-0 w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 font-bold text-base flex items-center justify-center">✕</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <button type="button" onClick={addWeightSlot}
                    className="w-full mt-1 py-2.5 rounded-xl border-2 border-dashed border-gray-200 hover:border-[#E8726A] hover:bg-orange-50 text-gray-500 hover:text-[#E8726A] text-base font-bold transition-colors">
                    + Add weight
                  </button>
                  <div className={`mt-3 rounded-xl px-4 py-3 flex items-center justify-between ${allSlotsWeighed && totalWeight > 0 ? "bg-[#0D2240]" : "bg-gray-100"}`}>
                    <span className={`text-base font-bold ${allSlotsWeighed && totalWeight > 0 ? "text-white/70" : "text-gray-400"}`}>Total</span>
                    <span className={`text-2xl font-black font-mono ${allSlotsWeighed && totalWeight > 0 ? "text-[#E8726A]" : "text-gray-300"}`}>
                      {totalWeight > 0 ? `${totalWeight.toFixed(1)} lbs` : "— lbs"}
                    </span>
                  </div>
                  <input type="hidden" name="bookingId" value={bookingId} />
                  <input type="hidden" name="weightLbs" value={totalWeight.toFixed(1)} />
                  {weightError && (
                    <p className="text-red-500 text-sm font-semibold mt-2">⚠ Enter weight for all bags before confirming — weighing is required</p>
                  )}
                </div>

                <button type="submit" disabled={submitting === "dropoff"}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl text-lg transition-colors">
                  {submitting === "dropoff"
                    ? "Saving…"
                    : dropoffLocation === "facility"
                      ? `🏭 Confirm Facility Drop-off · ${totalWeight > 0 ? totalWeight.toFixed(1) + " lbs" : "enter weights"}`
                      : `🏪 Confirm Warehouse Drop-off · ${totalWeight > 0 ? totalWeight.toFixed(1) + " lbs" : "enter weights"}`}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Waiting states ── */}
      {allAtWarehouse && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 text-center">
          <p className="text-amber-700 font-extrabold text-xl">🏪 At Warehouse</p>
          <p className="text-amber-600 text-base mt-1">Bags are at the warehouse. A transport run will move them to the laundry facility.</p>
          {deliveryDate && <p className="text-amber-500 text-sm mt-2">Scheduled delivery: {deliveryDate}</p>}
        </div>
      )}

      {allAtFacility && !allReady && (
        <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-5 text-center">
          <p className="text-purple-700 font-extrabold text-xl">🏭 Being Processed</p>
          <p className="text-purple-600 text-base mt-1">
            Washing, drying &amp; folding{assignedFacilityName ? ` at ${assignedFacilityName}` : ""}.
          </p>
          {deliveryDate && <p className="text-purple-500 text-sm mt-2">Scheduled delivery: {deliveryDate}</p>}
        </div>
      )}

      {allReady && !allReadyAtWarehouse && (
        <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-5 text-center">
          <p className="text-green-700 font-extrabold text-xl">✅ Ready at Facility</p>
          <p className="text-green-600 text-base mt-1">Bags are clean. Awaiting return transport run to warehouse.</p>
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
              <p className="text-white font-extrabold text-lg uppercase tracking-wide">Delivery Phase</p>
              <p className="text-white/70 text-sm">Collect clean bags from warehouse · deliver to customer</p>
            </div>
          </div>

          <div className="bg-white p-5 space-y-5">

            {/* Step 1: Pick up from warehouse */}
            {allReadyAtWarehouse && (
              <div className="space-y-3">
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-center">
                  <p className="text-teal-700 font-extrabold">✅ Bags ready at warehouse!</p>
                  <p className="text-teal-600 text-base mt-0.5">Go to the warehouse and collect the clean bags.</p>
                </div>
                <div>
                  <p className="text-base font-extrabold text-[#0D2240] mb-0.5">Step 1 — Collect from warehouse</p>
                  <p className="text-sm text-gray-500">Take a photo of the clean bags at the warehouse, then start the delivery run.</p>
                </div>
                <div className={`rounded-xl overflow-hidden border-2 ${warehousePickupPhotoErr ? "border-red-400" : hasWarehousePickupPhoto ? "border-green-400" : "border-gray-200"}`}>
                  <PhotoUploader bookingId={bookingId} action={recordPhotoEvent}
                    eventType="photo_facility_pickup" label="📷 Photo at Warehouse — Clean Bags"
                    onPhotoUploaded={() => { setHasWarehousePickupPhoto(true); setWarehousePickupPhotoErr(false) }} />
                  <PhotoRequired taken={hasWarehousePickupPhoto} error={warehousePickupPhotoErr} />
                </div>
                <button onClick={handleDeliveryStart} disabled={submitting === "start"}
                  className="w-full bg-[#0D2240] hover:bg-[#1a3a5c] disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl text-lg transition-colors">
                  {submitting === "start" ? "Starting…" : "🚐 Start Delivery Run"}
                </button>
              </div>
            )}

            {/* Step 2: Deliver to customer */}
            {allOutForDel && (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                  <p className="text-blue-700 font-extrabold">🚐 Out for delivery</p>
                  <p className="text-blue-600 text-base mt-0.5">Head to the customer and hand over the clean bags.</p>
                </div>
                <div>
                  <p className="text-base font-extrabold text-[#0D2240] mb-0.5">Step 2 — Deliver to customer</p>
                  <p className="text-sm text-gray-500">Take a photo at the customer's door, then confirm delivery.</p>
                </div>
                <div className={`rounded-xl overflow-hidden border-2 ${deliveryPhotoErr ? "border-red-400" : hasDeliveryPhoto ? "border-green-400" : "border-gray-200"}`}>
                  <PhotoUploader bookingId={bookingId} action={recordPhotoEvent}
                    eventType="photo_customer_delivery" label="📷 Photo at Customer — Delivery"
                    onPhotoUploaded={() => { setHasDeliveryPhoto(true); setDeliveryPhotoErr(false) }} />
                  <PhotoRequired taken={hasDeliveryPhoto} error={deliveryPhotoErr} />
                </div>
                <button onClick={handleDelivered} disabled={submitting === "delivered"}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl text-lg transition-colors">
                  {submitting === "delivered" ? "Confirming…" : "🎉 Confirm Delivered to Customer"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {allDone && (
        <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-6 text-center">
          <p className="text-green-700 font-extrabold text-2xl">🎉 Order Complete</p>
          <p className="text-green-600 text-base mt-1">All bags delivered successfully.</p>
        </div>
      )}
    </div>
  )
}
