"use client"

import { useState } from "react"
import PhotoUploader from "./photo-uploader"
import { WorkerNameInput } from "./worker-name-input"

interface Props {
  bookingId: string
  pickupBagCount: number
  buttonColor: string
  advanceOrder: (formData: FormData) => Promise<void>
  recordFoldingPhoto: (formData: FormData) => Promise<void>
}

export function FoldingForm({ bookingId, pickupBagCount, buttonColor, advanceOrder, recordFoldingPhoto }: Props) {
  const [hasPhoto, setHasPhoto] = useState(false)

  return (
    <form action={advanceOrder} className="p-4 space-y-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="nextStatus" value="ready" />
      <WorkerNameInput name="operatorName" />

      {/* Output bag count */}
      <div>
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
          How many bags are packed for delivery?
        </label>
        <div className="flex items-center gap-3">
          <input name="output_bags" type="number" min="1" defaultValue={pickupBagCount}
            className="w-24 rounded-xl border-2 border-gray-200 px-3 py-2.5 text-xl font-extrabold text-[#0D2240] text-center focus:outline-none focus:border-[#E8726A]" />
          <p className="text-xs text-gray-400">bags out<br /><span className="text-gray-300">(picked up: {pickupBagCount})</span></p>
        </div>
      </div>

      {/* Required photo */}
      <div className={`rounded-xl border-2 p-3 transition-colors ${hasPhoto ? "border-green-300 bg-green-50" : "border-red-200 bg-red-50"}`}>
        <PhotoUploader
          bookingId={bookingId}
          action={recordFoldingPhoto}
          label={hasPhoto ? "📷 Folding Photo ✓" : "📷 Folding Photo (required)"}
          emptyHint="Take a photo of the packed bags before marking ready."
          compact
          onPhotoUploaded={() => setHasPhoto(true)}
        />
        {!hasPhoto && (
          <p className="text-xs text-red-500 font-semibold mt-2">A photo is required before marking ready.</p>
        )}
      </div>

      <button
        type="submit"
        disabled={!hasPhoto}
        className={`w-full text-white font-extrabold py-4 rounded-2xl text-base transition-colors ${
          hasPhoto ? `${buttonColor}` : "bg-gray-200 text-gray-400 cursor-not-allowed"
        }`}
      >
        {hasPhoto ? "→ Mark Ready for Pickup" : "📷 Take photo first"}
      </button>
    </form>
  )
}
