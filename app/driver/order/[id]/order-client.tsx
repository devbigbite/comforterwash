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
  confirmPickup:  (fd: FormData) => Promise<void>
  confirmDropoff: (fd: FormData) => Promise<void>
  confirmDelivery:(fd: FormData) => Promise<void>
  recordPhotoEvent:(fd: FormData) => Promise<void>
}

const STORAGE_KEY = "washfold_driver_name"

export default function DriverOrderClient({
  bookingId, bags, facilities, estimatedLbs, facilityWarning,
  allPending, allPickedUp, somePickedUp, allAtFacility, allReady, allOutForDel, allDone,
  deliveryDate,
  confirmPickup, confirmDropoff, confirmDelivery, recordPhotoEvent,
}: Props) {
  const [driverName, setDriverName] = useState("")
  const [hasPhoto, setHasPhoto] = useState(false)
  const [nameError, setNameError] = useState(false)
  const [photoError, setPhotoError] = useState(false)
  const [submitting, setSubmitting] = useState<string | null>(null)

  // Load saved name on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) setDriverName(saved)
  }, [])

  function saveName(n: string) {
    setDriverName(n)
    if (n.trim()) localStorage.setItem(STORAGE_KEY, n.trim())
    setNameError(false)
  }

  async function handlePickup() {
    let valid = true
    if (!driverName.trim()) { setNameError(true); valid = false }
    if (!hasPhoto) { setPhotoError(true); valid = false }
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
    if (!driverName.trim()) { setNameError(true); return }
    setSubmitting("dropoff")
    const fd = new FormData(e.currentTarget)
    fd.set("driverName", driverName.trim())
    await confirmDropoff(fd)
    setSubmitting(null)
  }

  async function handleDeliveryStart() {
    if (!driverName.trim()) { setNameError(true); return }
    setSubmitting("start")
    const fd = new FormData()
    fd.append("bookingId", bookingId)
    fd.append("driverName", driverName.trim())
    fd.append("nextStatus", "out_for_delivery")
    await confirmDelivery(fd)
    setSubmitting(null)
  }

  async function handleDelivered() {
    if (!driverName.trim()) { setNameError(true); return }
    setSubmitting("delivered")
    const fd = new FormData()
    fd.append("bookingId", bookingId)
    fd.append("driverName", driverName.trim())
    fd.append("nextStatus", "delivered")
    await confirmDelivery(fd)
    setSubmitting(null)
  }

  const isPickupPhase   = allPending || allPickedUp || somePickedUp && !allAtFacility
  const isDeliveryPhase = allReady || allOutForDel

  return (
    <div className="space-y-4">

      {/* ── Driver name (persistent) ───────────────────────────────── */}
      <div className={`bg-white rounded-2xl shadow-sm border p-4 ${nameError ? "border-red-400" : "border-gray-100"}`}>
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
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
      {/* PICKUP PHASE */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {isPickupPhase && (
        <div className="rounded-2xl overflow-hidden border-2 border-[#E8726A]">
          {/* Phase banner */}
          <div className="bg-[#E8726A] px-5 py-3 flex items-center gap-3">
            <span className="text-2xl">📦</span>
            <div>
              <p className="text-white font-extrabold text-base uppercase tracking-wide">Pickup Phase</p>
              <p className="text-white/75 text-xs">Collect bags from customer · drop off at facility</p>
            </div>
          </div>

          <div className="bg-white p-5 space-y-4">

            {/* Photo — required for pickup */}
            <div className={`rounded-xl overflow-hidden border-2 transition-colors ${photoError ? "border-red-400" : hasPhoto ? "border-green-400" : "border-gray-200"}`}>
              <PhotoUploader
                bookingId={bookingId}
                action={recordPhotoEvent}
                onPhotoUploaded={() => { setHasPhoto(true); setPhotoError(false) }}
              />
              {photoError && <p className="px-4 pb-3 text-red-500 text-xs font-semibold">⚠ At least one photo is required before confirming pickup</p>}
              {hasPhoto && <p className="px-4 pb-3 text-green-600 text-xs font-semibold">✓ Photo taken</p>}
            </div>

            {/* Step 1: Confirm pickup from customer */}
            {allPending && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">
                  Step 1 — Confirm pickup from customer
                </p>
                <p className="text-xs text-gray-400 mb-3">
                  Label all {bags.length} bag{bags.length !== 1 ? "s" : ""} with the codes shown above, take a photo, then confirm.
                </p>
                <button
                  onClick={handlePickup}
                  disabled={submitting === "pickup"}
                  className="w-full bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl text-base transition-colors"
                >
                  {submitting === "pickup" ? "Confirming…" : `📦 Confirm Pickup of All ${bags.length} Bags`}
                </button>
              </div>
            )}

            {/* Step 2: Drop-off at facility */}
            {(allPickedUp || somePickedUp) && !allAtFacility && (
              <form onSubmit={handleDropoff} className="space-y-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">
                  Step 2 — Drop-off at facility + weigh
                </p>
                <p className="text-xs text-gray-400 mb-3">
                  Weigh the bags on the facility scale, select facility, enter weight. This locks the customer charge and triggers payment.
                </p>

                {facilityWarning.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                    ⚠️ <strong>Heads up:</strong> {facilityWarning.join(", ")} has a minimum above estimated weight ({estimatedLbs} lbs).
                  </div>
                )}

                <input type="hidden" name="bookingId" value={bookingId} />

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Facility</label>
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
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Processing Model</label>
                  <select name="facilityProcessingMode" required
                    className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:border-[#E8726A]">
                    <option value="own_operator">Own Operator — WashFold staff processes</option>
                    <option value="partner_attendant">Partner Attendant — facility staff processes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                    Actual Weight (lbs) <span className="text-[#E8726A]">*</span>
                  </label>
                  <input name="weightLbs" type="number" step="0.1" min="0.1" required
                    placeholder={`e.g. ${estimatedLbs || 25}`}
                    className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:border-[#E8726A] text-center text-xl font-bold font-mono" />
                  <p className="text-xs text-gray-400 mt-1">Customer is charged max(actual, 20 lbs) × rate</p>
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
          {deliveryDate && <p className="text-purple-400 text-xs mt-2">Scheduled delivery: {deliveryDate}</p>}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* DELIVERY PHASE */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {isDeliveryPhase && (
        <div className="rounded-2xl overflow-hidden border-2 border-[#0D2240]">
          {/* Phase banner */}
          <div className="bg-[#0D2240] px-5 py-3 flex items-center gap-3">
            <span className="text-2xl">🚐</span>
            <div>
              <p className="text-white font-extrabold text-base uppercase tracking-wide">Delivery Phase</p>
              <p className="text-white/60 text-xs">Pick up clean laundry from facility · deliver to customer</p>
            </div>
          </div>

          <div className="bg-white p-5 space-y-4">

            {allReady && (
              <>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <p className="text-green-700 font-extrabold">✅ Bags ready for delivery!</p>
                  <p className="text-green-600 text-sm mt-0.5">Pick up from facility and deliver to customer.</p>
                </div>
                <button
                  onClick={handleDeliveryStart}
                  disabled={submitting === "start"}
                  className="w-full bg-[#0D2240] hover:bg-[#1a3a5c] disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl text-base transition-colors"
                >
                  {submitting === "start" ? "Starting…" : "🚐 Start Delivery Run"}
                </button>
              </>
            )}

            {allOutForDel && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                  <p className="text-blue-700 font-extrabold">🚐 Out for delivery</p>
                  <p className="text-blue-600 text-sm mt-0.5">Confirm once bags are handed to the customer.</p>
                </div>
                <button
                  onClick={handleDelivered}
                  disabled={submitting === "delivered"}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl text-base transition-colors"
                >
                  {submitting === "delivered" ? "Confirming…" : "🎉 Confirm Delivered to Customer"}
                </button>
              </>
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
