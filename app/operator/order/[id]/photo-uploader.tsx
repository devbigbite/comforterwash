"use client"

import { useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

// Races a promise against a plain timeout, resolving to `fallback` if the
// promise hasn't settled in time. Same technique as the driver app's
// photo-uploader.tsx -- some phones/formats leave createImageBitmap()
// neither resolving nor rejecting, and Supabase's storage upload() has no
// timeout of its own, so anything that awaits a real network call on this
// facility's WiFi needs a hard backstop or it can hang the "Uploading..."
// spinner indefinitely with nothing for the operator to do about it.
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(fallback), ms)
    promise.then(value => { clearTimeout(timer); resolve(value) }, () => { clearTimeout(timer); resolve(fallback) })
  })
}

// Downscales + re-encodes a phone-camera photo before upload. This uploader
// previously sent the raw camera capture straight through -- 3+ MB per
// folding photo, uncompressed -- which made the photo slow to render on the
// admin Order Timeline (looking, to a non-technical eye, like "the photo
// isn't there") and slow to upload on a facility's WiFi. Matches the same
// 800px-long-edge / JPEG q=0.75 setting used by the driver app's photo
// uploader -- still plenty of detail to confirm bag counts and general
// condition, a fraction of the file size. Falls back to the original file
// if compression fails for any reason (e.g. an unsupported format).
async function compressImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file)
    const MAX_EDGE = 800
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)

    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)

    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.75))
    if (!blob) return file

    const compressedName = file.name.replace(/\.\w+$/, "") + ".jpg"
    return new File([blob], compressedName, { type: "image/jpeg" })
  } catch {
    return file
  }
}

// A photo the uploader already knows is saved to order_events -- carries
// the event id so it can be deleted. A photo just uploaded in this browser
// session (see handleFile) has no id yet, since the insert action here
// doesn't return one; those simply render without a delete button until
// the next page load picks them up as initialPhotos.
interface SavedPhoto {
  id: string
  url: string
  // Already-formatted, tenant-timezone label (e.g. "Sep 15, 2:47 PM") for
  // when this photo was taken -- computed server-side (formatEventTime in
  // app/admin/orders/[id]/page.tsx) so this client component never has to
  // do its own timezone math. Absent for a photo just uploaded in this
  // browser session before the next page load picks up its real timestamp.
  takenAt?: string
}

interface Props {
  bookingId: string
  action: (formData: FormData) => Promise<void>
  label?: string
  emptyHint?: string
  compact?: boolean
  onPhotoUploaded?: () => void
  // Photos already saved for this booking/event — without this, the
  // component only knows about uploads made in the current browser session,
  // so a refresh (or just navigating back later) makes previously-saved
  // photos look like they vanished even though they're still in the
  // database. Pass in whatever's already on file so it renders immediately.
  // Plain strings still work (older callers that don't need delete); pass
  // SavedPhoto objects to also get a delete button per photo.
  initialPhotos?: (string | SavedPhoto)[]
  // When provided, each already-saved photo (one with a known event id)
  // gets a small delete button. Takes the same (bookingId, eventId) shape
  // as the other form actions on this page.
  onDeletePhoto?: (formData: FormData) => Promise<void>
}

export default function PhotoUploader({
  bookingId,
  action,
  label = "📷 Photos",
  emptyHint = "Tap \"+ Add Photo\" to take a photo.",
  compact = false,
  onPhotoUploaded,
  initialPhotos = [],
  onDeletePhoto,
}: Props) {
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [photos, setPhotos] = useState<SavedPhoto[]>(
    initialPhotos.map((p) => (typeof p === "string" ? { id: "", url: p } : p))
  )
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleDelete(photoId: string) {
    if (!onDeletePhoto || !photoId) return
    if (!window.confirm("Delete this photo? This can't be undone.")) return
    setDeletingId(photoId)
    const fd = new FormData()
    fd.append("bookingId", bookingId)
    fd.append("eventId", photoId)
    try {
      await onDeletePhoto(fd)
      setPhotos((prev) => prev.filter((p) => p.id !== photoId))
    } finally {
      setDeletingId(null)
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFile = e.target.files?.[0]
    if (!rawFile) return

    setUploading(true)
    setError(null)

    // Bound the compression step the same way the driver app does -- a hang
    // in createImageBitmap() degrades to "use the original file" instead of
    // stranding the operator on a spinner forever.
    const file = await withTimeout(compressImage(rawFile), 8000, rawFile)

    const supabase = createClient()
    const safeName = file.name.replace(/[^a-z0-9.]/gi, "_").toLowerCase()
    const path = `${bookingId}/${Date.now()}-${safeName}`
    const contentType = file.type && file.type.startsWith("image/") ? file.type : "image/jpeg"

    const uploadPromise = supabase.storage
      .from("order-photos")
      .upload(path, file, { upsert: false, contentType })
      .then(({ error }) => (error ? error.message : null))
      .catch((err) => (err instanceof Error ? err.message : String(err)))

    // Same fix as the driver app's attemptUpload -- bound the upload call
    // itself against a timeout so a dead connection can't hang this forever
    // with no error and no way to retry.
    const uploadErrorMessage = await withTimeout(uploadPromise, 20000, "Upload timed out — check your connection and try again")

    if (uploadErrorMessage) {
      setError(uploadErrorMessage)
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from("order-photos")
      .getPublicUrl(path)

    setPhotos((prev) => [...prev, { id: "", url: publicUrl, takenAt: "Just now" }])
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
            {photos.map((p, i) => (
              <div key={p.id || i}>
                <div className="relative">
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt={`Photo ${i + 1}`}
                      className="w-full aspect-square object-cover rounded-lg border border-gray-100"
                    />
                  </a>
                  {onDeletePhoto && p.id && (
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      disabled={deletingId === p.id}
                      title="Delete photo"
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-900/80 hover:bg-red-600 text-white text-xs leading-none flex items-center justify-center disabled:opacity-50"
                    >
                      {deletingId === p.id ? "…" : "×"}
                    </button>
                  )}
                </div>
                {p.takenAt && <p className="text-[9px] text-gray-400 mt-0.5 text-center truncate">{p.takenAt}</p>}
              </div>
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
          {photos.map((p, i) => (
            <div key={p.id || i}>
              <div className="relative">
                <a href={p.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={`Photo ${i + 1}`}
                    className="w-full aspect-square object-cover rounded-xl border border-gray-100"
                  />
                </a>
                {onDeletePhoto && p.id && (
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
                    disabled={deletingId === p.id}
                    title="Delete photo"
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-gray-900/80 hover:bg-red-600 text-white text-sm leading-none flex items-center justify-center disabled:opacity-50"
                  >
                    {deletingId === p.id ? "…" : "×"}
                  </button>
                )}
              </div>
              {p.takenAt && <p className="text-[10px] text-gray-400 mt-1 text-center">{p.takenAt}</p>}
            </div>
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
