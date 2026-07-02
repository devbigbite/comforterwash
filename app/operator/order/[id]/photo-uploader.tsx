"use client"

import { useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

interface Props {
  bookingId: string
  action: (formData: FormData) => Promise<void>
  label?: string
  emptyHint?: string
  compact?: boolean
  onPhotoUploaded?: () => void
}

export default function PhotoUploader({
  bookingId,
  action,
  label = "📷 Photos",
  emptyHint = "Tap \"+ Add Photo\" to take a photo.",
  compact = false,
  onPhotoUploaded,
}: Props) {
  const [uploading, setUploading] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    const supabase = createClient()
    const safeName = file.name.replace(/[^a-z0-9.]/gi, "_").toLowerCase()
    const path = `${bookingId}/${Date.now()}-${safeName}`

    const { error: uploadError } = await supabase.storage
      .from("order-photos")
      .upload(path, file, { upsert: false })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from("order-photos")
      .getPublicUrl(path)

    setPhotos((prev) => [...prev, publicUrl])
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ""
    onPhotoUploaded?.()

    const fd = new FormData()
    fd.append("bookingId", bookingId)
    fd.append("photoUrl", publicUrl)
    await action(fd)
  }

  if (compact) {
    // Inline layout used inside another card
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-50 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            {uploading ? "Uploading…" : "+ Add Photo"}
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="hidden"
        />
        {uploading && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="w-3 h-3 border-2 border-[#E8726A] border-t-transparent rounded-full animate-spin" />
            Uploading…
          </div>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
        {photos.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5">
            {photos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Photo ${i + 1}`}
                  className="w-full aspect-square object-cover rounded-lg border border-gray-100"
                />
              </a>
            ))}
          </div>
        )}
        {photos.length === 0 && !uploading && (
          <p className="text-xs text-gray-300">{emptyHint}</p>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-[#0D2240] text-sm">{label}</h3>
          {photos.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">{photos.length} photo{photos.length !== 1 ? "s" : ""} saved</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors"
        >
          {uploading ? "Uploading…" : "+ Add Photo"}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />
      {photos.length > 0 && (
        <div className="p-3 grid grid-cols-3 gap-2">
          {photos.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Photo ${i + 1}`}
                className="w-full aspect-square object-cover rounded-xl border border-gray-100"
              />
            </a>
          ))}
        </div>
      )}
      {uploading && (
        <div className="px-4 py-3 flex items-center gap-2 text-sm text-gray-500">
          <div className="w-4 h-4 border-2 border-[#E8726A] border-t-transparent rounded-full animate-spin" />
          Uploading photo…
        </div>
      )}
      {error && <p className="px-4 py-2 text-xs text-red-500">{error}</p>}
      {photos.length === 0 && !uploading && (
        <div className="px-4 py-5 text-center">
          <p className="text-sm text-gray-400">No photos yet.</p>
          <p className="text-xs text-gray-300 mt-0.5">{emptyHint}</p>
        </div>
      )}
    </div>
  )
}
