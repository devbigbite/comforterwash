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
  deliveryDate,
  confirmPickup, confirmDropoff, confirmDelivery, recordPhotoEvent,
}: Props) {
  const [driverName, setDriverName] = useState("")
  const [nameError, setNameError] = useState(false)
  const [submitting, setSubmitting] = useState<string | null>(null)

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
    setSubmitting("dropoff")
    const fd = new FormData(e.currentTarget)
    fd.set("driverName", driverName.trim())
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

  const isPickupPhase   = allPending || allPickedUp || (somePickedUp && !allAtFacility)
  const isDeliveryPhase = allReady || allOutForDel

  return (
    <div className="space-y-4">

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
      {isPickupPhase && (
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
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                    Actual Weight (lbs) <span className="text-[#E8726A]">*</span>
                  </label>
                  <input name="weightLbs" type="number" step="0.1" min="0.1" required
                    placeholder={`e.g. ${estimatedLbs || 25}`}
                    className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:border-[#E8726A] text-center text-xl font-bold font-mono" />
                  <p className="text-xs text-gray-500 mt-1">Customer is charged max(actual, 20 lbs) × rate</p>
                </div>

                <button type="submit" disabled={submitting === "dropoff"}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl text-base transition-colors">
                  {submitting === "dropoff" ? "Saving…" : "🏭 Confirm Drop-off & Lock Weight"}
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
      {isDeliveryPhase && (
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
