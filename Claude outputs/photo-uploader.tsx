"use client"

import { useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

interface Props {
  bookingId: string
  action: (formData: FormData) => Promise<void>
  onPhotoUploaded?: (url?: string) => void
  eventType?: string
  label?: string
}

const MAX_DIMENSION = 1600 // px, long edge — plenty for proof-of-pickup photos
const JPEG_QUALITY = 0.72
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1500

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Downscale + re-encode as JPEG so weak cell signal at a pickup address
// doesn't time out uploading a raw 5-10MB camera photo.
async function compressImage(file: File): Promise<File> {
  // Skip compression for already-small files or non-image types we can't safely re-encode
  if (!file.type.startsWith("image/") || file.size < 400_000) return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    )
    if (!blob) return file

    const compressed = new File(
      [blob],
      file.name.replace(/\.\w+$/, "") + ".jpg",
      { type: "image/jpeg" }
    )
    // Only use the compressed version if it's actually smaller
    return compressed.size < file.size ? compressed : file
  } catch {
    // If compression fails for any reason, fall back to the original file
    return file
  }
}

async function uploadWithRetry(
  supabase: ReturnType<typeof createClient>,
  path: string,
  file: File
): Promise<{ error: { message: string } | null }> {
  let lastError: { message: string } | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const { error } = await supabase.storage
      .from("order-photos")
      .upload(path, file, { upsert: true })

    if (!error) return { error: null }

    lastError = error
    if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * (attempt + 1))
  }

  return { error: lastError }
}

export default function PhotoUploader({ bookingId, action, onPhotoUploaded, eventType = "photo_pickup", label = "📷 Pickup Photos" }: Props) {
  const [uploading, setUploading] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    setUploading(true)
    setError(null)

    const supabase = createClient()
    const toUpload = await compressImage(file)
    const safeName = toUpload.name.replace(/[^a-z0-9.]/gi, "_").toLowerCase()
    const path = `${bookingId}/${Date.now()}-${safeName}`

    const { error: uploadError } = await uploadWithRetry(supabase, path, toUpload)

    if (uploadError) {
      // Keep the file around so "Try Again" doesn't require reopening the camera
      setPendingFile(file)
      setError(uploadError.message || "Upload failed — check your connection and try again.")
      setUploading(false)
      setRetrying(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from("order-photos")
      .getPublicUrl(path)

    setPhotos((prev) => [...prev, publicUrl])
    setUploading(false)
    setRetrying(false)
    setPendingFile(null)
    if (inputRef.current) inputRef.current.value = ""
    onPhotoUploaded?.(publicUrl)

    // Record in DB via server action
    const fd = new FormData()
    fd.append("bookingId", bookingId)
    fd.append("photoUrl", publicUrl)
    fd.append("eventType", eventType)
    await action(fd)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadFile(file)
  }

  async function handleTryAgain() {
    if (!pendingFile) return
    setRetrying(true)
    await uploadFile(pendingFile)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-[#0D2240] text-sm">{label}</h3>
          {photos.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">{photos.length} photo{photos.length !== 1 ? "s" : ""} saved</p>
          )}
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors"
        >
          {uploading ? "Uploading…" : "+ Add Photo"}
        </button>
      </div>

      {/* Hidden file input — capture=environment opens rear camera on mobile */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="p-3 grid grid-cols-3 gap-2">
          {photos.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Pickup photo ${i + 1}`}
                className="w-full aspect-square object-cover rounded-xl border border-gray-100"
              />
            </a>
          ))}
        </div>
      )}

      {/* Upload progress indicator */}
      {uploading && (
        <div className="px-4 py-3 flex items-center gap-2 text-sm text-gray-500">
          <div className="w-4 h-4 border-2 border-[#E8726A] border-t-transparent rounded-full animate-spin" />
          {retrying ? "Retrying upload…" : "Uploading photo…"}
        </div>
      )}

      {error && !uploading && (
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <p className="text-xs text-red-500">{error}</p>
          {pendingFile && (
            <button
              onClick={handleTryAgain}
              className="shrink-0 bg-[#0D2240] hover:bg-[#16305c] text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {photos.length === 0 && !uploading && !error && (
        <div className="px-4 py-5 text-center">
          <p className="text-sm text-gray-400">No photos yet.</p>
          <p className="text-xs text-gray-300 mt-0.5">Tap "+ Add Photo" to take a pickup photo.</p>
        </div>
      )}
    </div>
  )
}
