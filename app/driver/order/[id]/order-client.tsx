"use client"

import { useState, useEffect } from "react"
import PhotoUploader from "./photo-uploader"

interface Bag { id: string; bag_number: number; label_code: string; status: string }
interface Facility { id: string; name: string; address: string; supports_own_operator: boolean; supports_partner_attendant: boolean; rate_per_lb: number | null; minimum_lbs: number | null }

interface Props {
  bookingId: string
  bags: Bag[]
  facilities: Facility[]
  estimatedLbs: number
  facilityWarning: string[]
  allPending: boolean
  allPickedUp: boolean
  somePickedUp: boolean
  allAtFacility: boolean
  allReady: boolean
  allOutForDel: boolean
  allDone: boolean
  pickupDate: string | null
  deliveryDate: string | null
  // server actions
  confirmPickup:   (fd: FormData) => Promise<void>
  confirmDropoff:  (fd: FormData) => Promise<void>
  confirmDelivery: (fd: FormData) => Promise<void>
  recordPhotoEvent:(fd: FormData) => Promise<void>
}

const STORAGE_KEY = "washfold_driver_name"

function PhotoRequired({ taken, error }: { taken: boolean; error: boolean }) {
  if (taken) return <p className="text-green-600 text-xs font-semibold px-1 pt-1">✓ Photo taken</p>
  if (error) return <p className="text-red-500 text-xs font-semibold px-1 pt-1">⚠ Photo required before continuing</p>
  return null
}

export default function DriverOrderClient({
  bookingId, bags, facilities, estimatedLbs, facilityWarning,
  allPending, allPickedUp, somePickedUp, allAtFacility, allReady, allOutForDel, allDone,
  pickupDate, deliveryDate,
  confirmPickup, confirmDropoff, confirmDelivery, recordPhotoEvent,
}: Props) {
  const today = new Date().toISOString().split("T")[0]
  const isPickupDay   = pickupDate   === today
  const isDeliveryDay = deliveryDate === today
  const [driverName, setDriverName] = useState("")
  const [nameError, setNameError] = useState(false)
  const [submitting, setSubmitting] = useState<string | null>(null)

  // Per-bag weights for dropoff — starts at bag count, driver can add more
  const [bagWeights, setBagWeights] = useState<string[]>(() => bags.map(() => ""))
  const totalWeight = bagWeights.reduce((sum, w) => sum + (parseFloat(w) || 0), 0)
  const allSlotsWeighed = bagWeights.length > 0 && bagWeights.every(w => parseFloat(w) > 0)

  function updateBagWeight(i: number, val: string) {
    setBagWeights(prev => { const next = [...prev]; next[i] = val; return next })
  }
  function addWeightSlot() {
    setBagWeights(prev => [...prev, ""])
  }
  function removeWeightSlot(i: number) {
    setBagWeights(prev => prev.filter((_, idx) => idx !== i))
  }

  // 4 photo checkpoints
  const [hasCustomerPickupPhoto,  setHasCustomerPickupPhoto]  = useState(false)
  const [customerPickupPhotoErr,  setCustomerPickupPhotoErr]  = useState(false)
  const [hasDropoffPhoto,         setHasDropoffPhoto]         = useState(false)
  const [dropoffPhotoErr,         setDropoffPhotoErr]         = useState(false)
  const [hasFacilityPickupPhoto,  setHasFacilityPickupPhoto]  = useState(false)
  const [facilityPickupPhotoErr,  setFacilityPickupPhotoErr]  = useState(false)
  const [hasDeliveryPhoto,        setHasDeliveryPhoto]        = useState(false)
  const [deliveryPhotoErr,        setDeliveryPhotoErr]        = useState(false)

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

  async function handlePickup() {
    let valid = requireName()
    if (!hasCustomerPickupPhoto) { setCustomerPickupPhotoErr(true); valid = false }
    if (!valid) return
    setSubmitting("pickup")
    const fd = new FormData()
    fd.append("bookingId", bookingId)
    fd.append("driverName", driverName.trim())
    await confirmPickup(fd)
    setSubmitting(null)
  }

  async function handleDropoff(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!requireName()) return
    if (!hasDropoffPhoto) { setDropoffPhotoErr(true); return }
    if (!allSlotsWeighed || totalWeight <= 0) return
    setSubmitting("dropoff")
    const fd = new FormData(e.currentTarget)
    fd.set("driverName", driverName.trim())
    fd.set("weightLbs", totalWeight.toFixed(1))
    await confirmDropoff(fd)
    setSubmitting(null)
  }

  async function handleDeliveryStart() {
    if (!requireName()) return
    if (!hasFacilityPickupPhoto) { setFacilityPickupPhotoErr(true); return }
    setSubmitting("start")
    const fd = new FormData()
    fd.append("bookingId", bookingId)
    fd.append("driverName", driverName.trim())
    fd.append("nextStatus", "out_for_delivery")
    await confirmDelivery(fd)
    setSubmitting(null)
  }

  async function handleDelivered() {
    if (!requireName()) return
    if (!hasDeliveryPhoto) { setDeliveryPhotoErr(true); return }
    setSubmitting("delivered")
    const fd = new FormData()
    fd.append("bookingId", bookingId)
    fd.append("driverName", driverName.trim())
    fd.append("nextStatus", "delivered")
    await confirmDelivery(fd)
    setSubmitting(null)
  }

  // Bag-status phases
  const inPickupFlow   = allPending || allPickedUp || (somePickedUp && !allAtFacility)
  const inDeliveryFlow = allReady || allOutForDel

  // Show pickup only if bags are in pickup flow AND it's not delivery day
  // (keep showing if mid-dropoff even if a day late — driver still needs to complete it)
  const showPickup   = inPickupFlow   && !isDeliveryDay
  const showDelivery = inDeliveryFlow && !isPickupDay

  // Context banner config
  const todayBanner = isPickupDay   ? { label: "Today: Pickup",   sub: `Deliver to facility by end of day · delivery ${deliveryDate}`,  bg: "bg-[#E8726A]", icon: "📦" }
                    : isDeliveryDay ? { label: "Today: Delivery",  sub: `Return clean laundry to customer · picked up ${pickupDate}`,    bg: "bg-[#0D2240]", icon: "🚐" }
                    : inPickupFlow  ? { label: "Pickup in progress", sub: "Complete drop-off at facility",                               bg: "bg-orange-500", icon: "⏳" }
                    : allAtFacility && !allReady ? { label: "Being processed", sub: `Delivery scheduled for ${deliveryDate}`,            bg: "bg-purple-600", icon: "🏭" }
                    : null

  return (
    <div className="space-y-4">

      {/* ── Today's action banner ────────────────────────────────────── */}
      {todayBanner && !allDone && (
        <div className={`${todayBanner.bg} rounded-2xl px-5 py-3 flex items-center gap-3`}>
          <span className="text-2xl">{todayBanner.icon}</span>
          <div>
            <p className="text-white font-extrabold text-base uppercase tracking-wide">{todayBanner.label}</p>
            <p className="text-white/70 text-xs">{todayBanner.sub}</p>
          </div>
        </div>
      )}

      {/* ── Driver name ─────────────────────────────────────────────── */}
      <div className={`bg-white rounded-2xl shadow-sm border p-4 ${nameError ? "border-red-400" : "border-gray-100"}`}>
        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
          Your Name <span className="text-[#E8726A]">*</span>
        </label>
        <input
          type="text"
          value={driverName}
          onChange={e => saveName(e.target.value)}
          placeholder="Enter your name"
          className={`w-full rounded-xl border-2 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none transition-colors
            ${nameError ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-[#E8726A]"}`}
        />
        {nameError && <p className="text-red-500 text-xs mt-1 font-semibold">⚠ Name is required before continuing</p>}
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
              <p className="text-white/80 text-xs">Collect bags from customer · drop off at facility</p>
            </div>
          </div>

          <div className="bg-white p-5 space-y-5">

            {/* ── Step 1: Pickup from customer ── */}
            {allPending && (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-extrabold text-[#0D2240] mb-0.5">Step 1 — Pick up from customer</p>
                  <p className="text-xs text-gray-500">
                    Label all {bags.length} bag{bags.length !== 1 ? "s" : ""} with the order number, take a photo of the bags at the customer's location, then confirm.
                  </p>
                </div>

                <div className={`rounded-xl overflow-hidden border-2 transition-colors ${customerPickupPhotoErr ? "border-red-400" : hasCustomerPickupPhoto ? "border-green-400" : "border-gray-200"}`}>
                  <PhotoUploader
                    bookingId={bookingId}
                    action={recordPhotoEvent}
                    eventType="photo_customer_pickup"
                    label="📷 Photo at Customer"
                    onPhotoUploaded={() => { setHasCustomerPickupPhoto(true); setCustomerPickupPhotoErr(false) }}
                  />
                  <PhotoRequired taken={hasCustomerPickupPhoto} error={customerPickupPhotoErr} />
                </div>

                <button
                  onClick={handlePickup}
                  disabled={submitting === "pickup"}
                  className="w-full bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl text-base transition-colors"
                >
                  {submitting === "pickup" ? "Confirming…" : `📦 Confirm Pickup of All ${bags.length} Bags`}
                </button>
              </div>
            )}

            {/* ── Step 2: Drop-off at facility ── */}
            {(allPickedUp || somePickedUp) && !allAtFacility && (
              <form onSubmit={handleDropoff} className="space-y-3">
                <div>
                  <p className="text-sm font-extrabold text-[#0D2240] mb-0.5">Step 2 — Drop off at facility</p>
                  <p className="text-xs text-gray-500">
                    Weigh the bags on the facility scale, take a photo of the drop-off, select facility and enter weight. This locks the customer charge.
                  </p>
                </div>

                <div className={`rounded-xl overflow-hidden border-2 transition-colors ${dropoffPhotoErr ? "border-red-400" : hasDropoffPhoto ? "border-green-400" : "border-gray-200"}`}>
                  <PhotoUploader
                    bookingId={bookingId}
                    action={recordPhotoEvent}
                    eventType="photo_facility_dropoff"
                    label="📷 Photo at Facility Drop-off"
                    onPhotoUploaded={() => { setHasDropoffPhoto(true); setDropoffPhotoErr(false) }}
                  />
                  <PhotoRequired taken={hasDropoffPhoto} error={dropoffPhotoErr} />
                </div>

                {facilityWarning.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                    ⚠️ <strong>Heads up:</strong> {facilityWarning.join(", ")} has a minimum above estimated weight ({estimatedLbs} lbs).
                  </div>
                )}

                <input type="hidden" name="bookingId" value={bookingId} />

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">Facility</label>
                  <select name="facilityId" required
                    className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:border-[#E8726A]">
                    <option value="">— select facility —</option>
                    {facilities.map(f => {
                      const modes = [f.supports_own_operator && "Own Op", f.supports_partner_attendant && "Partner"].filter(Boolean).join(" + ")
                      return (
                        <option key={f.id} value={f.id}>
                          {f.name} · {modes}{f.rate_per_lb ? ` · $${f.rate_per_lb}/lb` : ""}{(f.minimum_lbs ?? 0) > 0 ? ` · min ${f.minimum_lbs} lbs` : ""}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">Processing Model</label>
                  <select name="facilityProcessingMode" required
                    className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:border-[#E8726A]">
                    <option value="own_operator">Own Operator — WashFold staff processes</option>
                    <option value="partner_attendant">Partner Attendant — facility staff processes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                    Bag Weights (lbs) <span className="text-[#E8726A]">*</span>
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Weigh each bag separately on the scale and enter below.
                  </p>

                  <div className="space-y-2">
                    {bagWeights.map((w, i) => {
                      const isPrimary = i < bags.length
                      const hasValue  = parseFloat(w) > 0
                      const label     = isPrimary ? `Bag ${i + 1}` : `Extra ${i - bags.length + 1}`
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span className={`w-14 shrink-0 text-xs font-bold uppercase tracking-wide ${isPrimary ? "text-gray-600" : "text-[#E8726A]"}`}>
                            {label}
                          </span>
                          <input
                            type="number" step="0.1" min="0.1"
                            value={w}
                            onChange={e => updateBagWeight(i, e.target.value)}
                            placeholder="0.0"
                            className={`flex-1 rounded-xl border-2 px-3 py-2.5 text-center text-xl font-bold font-mono text-[#0D2240] focus:outline-none transition-colors
                              ${hasValue ? "border-green-400 bg-green-50" : "border-gray-200 focus:border-[#E8726A]"}`}
                          />
                          <span className="shrink-0 text-sm font-semibold text-gray-500">lbs</span>
                          {!isPrimary && (
                            <button type="button" onClick={() => removeWeightSlot(i)}
                              className="shrink-0 w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 font-bold text-sm transition-colors flex items-center justify-center">
                              ✕
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Add weight slot */}
                  <button type="button" onClick={addWeightSlot}
                    className="w-full mt-1 py-2.5 rounded-xl border-2 border-dashed border-gray-200 hover:border-[#E8726A] hover:bg-orange-50 text-gray-500 hover:text-[#E8726A] text-sm font-bold transition-colors">
                    + Add weight
                  </button>

                  {/* Running total */}
                  <div className={`mt-3 rounded-xl px-4 py-3 flex items-center justify-between transition-colors
                    ${allBagsWeighed && totalWeight > 0 ? "bg-[#0D2240]" : "bg-gray-100"}`}>
                    <span className={`text-sm font-bold ${allBagsWeighed && totalWeight > 0 ? "text-white/70" : "text-gray-400"}`}>
                      Total weight
                    </span>
                    <span className={`text-2xl font-black font-mono ${allBagsWeighed && totalWeight > 0 ? "text-[#E8726A]" : "text-gray-300"}`}>
                      {totalWeight > 0 ? `${totalWeight.toFixed(1)} lbs` : "— lbs"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">
                    Customer charged for max({totalWeight > 0 ? `${totalWeight.toFixed(1)}` : "actual"}, 20 lbs) × rate
                  </p>

                  {/* Hidden field — value injected by handleDropoff */}
                  <input type="hidden" name="weightLbs" value={totalWeight.toFixed(1)} />
                </div>

                <button type="submit" disabled={submitting === "dropoff" || !allSlotsWeighed || totalWeight <= 0}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl text-base transition-colors">
                  {submitting === "dropoff" ? "Saving…" : `🏭 Confirm Drop-off · ${totalWeight > 0 ? totalWeight.toFixed(1) + " lbs total" : "enter all weights"}`}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* With operator — waiting state */}
      {allAtFacility && !allReady && (
        <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-5 text-center">
          <p className="text-purple-700 font-extrabold text-lg">🏭 With Operator</p>
          <p className="text-purple-600 text-sm mt-1">Bags are being washed, dried, and folded.</p>
          {deliveryDate && <p className="text-purple-500 text-xs mt-2">Scheduled delivery: {deliveryDate}</p>}
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
              <p className="text-white/70 text-xs">Pick up clean laundry from facility · deliver to customer</p>
            </div>
          </div>

          <div className="bg-white p-5 space-y-5">

            {/* ── Step 1: Pick up from facility ── */}
            {allReady && (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <p className="text-green-700 font-extrabold">✅ Bags ready for pickup!</p>
                  <p className="text-green-600 text-sm mt-0.5">Go to the facility, collect the clean bags.</p>
                </div>

                <div>
                  <p className="text-sm font-extrabold text-[#0D2240] mb-0.5">Step 1 — Pick up from facility</p>
                  <p className="text-xs text-gray-500">
                    Take a photo of the clean bags at the facility before leaving, then start the delivery run.
                  </p>
                </div>

                <div className={`rounded-xl overflow-hidden border-2 transition-colors ${facilityPickupPhotoErr ? "border-red-400" : hasFacilityPickupPhoto ? "border-green-400" : "border-gray-200"}`}>
                  <PhotoUploader
                    bookingId={bookingId}
                    action={recordPhotoEvent}
                    eventType="photo_facility_pickup"
                    label="📷 Photo at Facility — Clean Bags"
                    onPhotoUploaded={() => { setHasFacilityPickupPhoto(true); setFacilityPickupPhotoErr(false) }}
                  />
                  <PhotoRequired taken={hasFacilityPickupPhoto} error={facilityPickupPhotoErr} />
                </div>

                <button
                  onClick={handleDeliveryStart}
                  disabled={submitting === "start"}
                  className="w-full bg-[#0D2240] hover:bg-[#1a3a5c] disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl text-base transition-colors"
                >
                  {submitting === "start" ? "Starting…" : "🚐 Start Delivery Run"}
                </button>
              </div>
            )}

            {/* ── Step 2: Deliver to customer ── */}
            {allOutForDel && (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                  <p className="text-blue-700 font-extrabold">🚐 Out for delivery</p>
                  <p className="text-blue-600 text-sm mt-0.5">Head to the customer and hand over the clean bags.</p>
                </div>

                <div>
                  <p className="text-sm font-extrabold text-[#0D2240] mb-0.5">Step 2 — Deliver to customer</p>
                  <p className="text-xs text-gray-500">
                    Take a photo of the delivery at the customer's door, then confirm.
                  </p>
                </div>

                <div className={`rounded-xl overflow-hidden border-2 transition-colors ${deliveryPhotoErr ? "border-red-400" : hasDeliveryPhoto ? "border-green-400" : "border-gray-200"}`}>
                  <PhotoUploader
                    bookingId={bookingId}
                    action={recordPhotoEvent}
                    eventType="photo_customer_delivery"
                    label="📷 Photo at Customer — Delivery"
                    onPhotoUploaded={() => { setHasDeliveryPhoto(true); setDeliveryPhotoErr(false) }}
                  />
                  <PhotoRequired taken={hasDeliveryPhoto} error={deliveryPhotoErr} />
                </div>

                <button
                  onClick={handleDelivered}
                  disabled={submitting === "delivered"}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl text-base transition-colors"
                >
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
