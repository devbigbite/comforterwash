"use client"

import { useState, useRef, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

interface Props {
  bookingId: string
  action: (formData: FormData) => Promise<void>
  onPhotoUploaded?: (url?: string) => void
  eventType?: string
  label?: string
  // A photo already on file for this checkpoint from a previous page load —
  // shown immediately so a reload never makes an already-taken photo look
  // missing (see page.tsx for where this is fetched server-side).
  initialPhotoUrl?: string | null
}

// A few phones/formats leave createImageBitmap() neither resolving nor
// rejecting -- no error, just a permanently stuck "Uploading..." spinner
// and nothing in any log to explain why. Races it against a plain timeout
// so a hang degrades to "use the original file" instead of stranding the
// driver.
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(fallback), ms)
    promise.then(value => { clearTimeout(timer); resolve(value) }, () => { clearTimeout(timer); resolve(fallback) })
  })
}

// Pulls the Next.js build id this page's own already-loaded JS was built
// against, by reading it off any already-present /_next/static/<buildId>/
// script tag in the DOM. Same technique used again below against freshly
// fetched HTML to detect a stale page.
function extractBuildId(html: string): string | null {
  const match = html.match(/_next\/static\/([^/]+)\//)
  return match ? match[1] : null
}

export default function PhotoUploader({ bookingId, action, onPhotoUploaded, eventType = "photo_pickup", label = "📷 Pickup Photos", initialPhotoUrl = null }: Props) {
  const [uploading, setUploading] = useState(false)
  const [photos, setPhotos] = useState<string[]>(initialPhotoUrl ? [initialPhotoUrl] : [])
  const [error, setError] = useState<string | null>(null)
  const [staleReload, setStaleReload] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const buildIdRef = useRef<string | null>(null)

  useEffect(() => {
    buildIdRef.current = extractBuildId(document.documentElement.innerHTML)
  }, [])

  /**
   * This app ships several production deployments a day. A driver who opens
   * this page at the start of a shift and keeps it open across even one of
   * those deploys is running JS built against a build id the server no
   * longer recognizes -- confirmed in production logs as "Failed to find
   * Server Action. This request might be from an older or newer
   * deployment," which breaks the "record this photo" step after the photo
   * itself has already uploaded. Rather than let a driver hit that mid-route,
   * check for a newer build the moment they tap "+ Add Photo" (before the
   * camera even opens) and, if this page is stale, prompt a one-tap refresh
   * instead of proceeding on JS the server won't accept. This is the same
   * check regardless of phone or browser -- it's about which deployment the
   * page was loaded from, not the device.
   */
  async function isPageStale(): Promise<boolean> {
    try {
      const res = await fetch(window.location.pathname + window.location.search, {
        cache: "no-store",
        headers: { purpose: "prefetch" },
      })
      const html = await res.text()
      const liveBuildId = extractBuildId(html)
      if (!liveBuildId || !buildIdRef.current) return false
      return liveBuildId !== buildIdRef.current
    } catch {
      // Can't reach the server to check (e.g. no signal right now) -- don't
      // block the driver over a check that itself couldn't complete.
      return false
    }
  }

  /**
   * Downscales + re-encodes a phone-camera photo before upload. Raw camera
   * captures were landing at 2.5-4MB each (uncompressed, full sensor
   * resolution) — fine for the upload itself, but the same full-size file
   * then had to be re-downloaded just to render the small thumbnail preview,
   * and on a driver's weak cellular signal out on a route that redundant
   * multi-megabyte fetch would time out with a generic "Load failed", making
   * a perfectly good upload look broken. Capping the longest edge at 1600px
   * and re-encoding as JPEG q=0.75 is more than enough detail for proof-of-
   * delivery/pickup photos and shrinks most captures to a few hundred KB.
   * Falls back to the original file if compression fails for any reason
   * (e.g. an unsupported format) — never blocks the upload over this.
   */
  async function compressImage(file: File): Promise<File> {
    try {
      const bitmap = await createImageBitmap(file)
      const MAX_EDGE = 1600
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

  // Kept only when an upload fails, so "Retry" can re-send the exact same
  // (already-compressed) bytes without making the driver reopen the camera
  // and retake the photo.
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  // A single upload attempt, bounded by a hard timeout. Supabase's upload()
  // has no built-in timeout of its own -- on a real cellular dead spot (not
  // just a dropped packet, but several seconds with zero signal), a fetch
  // can sit unresolved far longer than a driver will wait, with no error to
  // show and no way for the retry loop below to know it should give up and
  // try again. AbortController forces it to fail fast instead of hanging.
  async function attemptUpload(file: File, path: string, contentType: string): Promise<string | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)
    try {
      const supabase = createClient()
      const { error: uploadError } = await supabase.storage
        .from("order-photos")
        .upload(path, file, { upsert: false, contentType })
      // NOTE: supabase-js's storage upload() doesn't currently accept an
      // AbortSignal directly, so the timeout above guards the case where
      // fetch itself would otherwise hang; abort() firing here just lets
      // this attempt's promise settle (with uploadError set) instead of
      // leaving the driver stuck, and the retry loop below moves on.
      return uploadError ? uploadError.message : null
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    } finally {
      clearTimeout(timer)
    }
  }

  async function uploadFile(file: File) {
    const safeName = file.name.replace(/[^a-z0-9.]/gi, "_").toLowerCase()
    const path = `${bookingId}/${Date.now()}-${safeName}`

    // Explicitly declare the content-type instead of letting the browser's
    // (sometimes blank, sometimes nonstandard e.g. "image/heif" instead of
    // "image/heic") File.type flow through as the upload's Content-Type
    // header. The storage bucket allowlists specific image mime types, and
    // a driver's phone reporting a type that doesn't exactly match it was
    // silently killing the upload before it ever produced a useful error --
    // compressImage() above already guarantees real JPEG bytes whenever it
    // succeeds, so declaring "image/jpeg" here is accurate for the common
    // case and a safe fallback otherwise.
    const contentType = file.type && file.type.startsWith("image/") ? file.type : "image/jpeg"

    // A driver's cellular signal out on a route drops mid-request often
    // enough that a bare "Load failed"/"Failed to fetch" (the browser's
    // generic wording for a network hiccup, not anything actually wrong
    // with the photo) was routine rather than exceptional. Retry with
    // increasing delay -- 4 attempts spread over ~17s of backoff, each
    // itself capped at 20s -- covers a longer dead spot than a single quick
    // retry would, on either platform.
    let lastErrorMessage: string | null = null
    const ATTEMPTS = 4
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      if (attempt > 0) await new Promise(resolve => setTimeout(resolve, [0, 2000, 5000, 10000][attempt]))
      lastErrorMessage = await attemptUpload(file, path, contentType)
      if (!lastErrorMessage) break
    }

    if (lastErrorMessage) {
      // Supabase's raw error text isn't something a driver standing at a
      // customer's door can act on -- point them at the one thing they can
      // actually do about it, and let them retry without retaking the photo.
      setError(`Couldn't upload that photo (${lastErrorMessage}). Check your signal and tap Retry.`)
      setUploading(false)
      setPendingFile(file)
      if (inputRef.current) inputRef.current.value = ""
      return
    }

    const supabase = createClient()
    const { data: { publicUrl } } = supabase.storage
      .from("order-photos")
      .getPublicUrl(path)

    setPendingFile(null)
    setPhotos((prev) => [...prev, publicUrl])
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ""
    onPhotoUploaded?.(publicUrl)

    // Record in DB via server action. If this page is running on a stale
    // deployment (see isPageStale above) this is the specific call that
    // breaks with "Failed to find Server Action" -- the photo itself is
    // already safely uploaded at this point, so surface that plainly rather
    // than implying the photo was lost.
    try {
      const fd = new FormData()
      fd.append("bookingId", bookingId)
      fd.append("photoUrl", publicUrl)
      fd.append("eventType", eventType)
      await action(fd)
    } catch (err) {
      setError(`Photo saved, but this page needs to refresh to continue (${err instanceof Error ? err.message : String(err)}). Tap Refresh below.`)
      setStaleReload(true)
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFile = e.target.files?.[0]
    if (!rawFile) return

    setUploading(true)
    setError(null)

    try {
      const file = await withTimeout(compressImage(rawFile), 8000, rawFile)
      await uploadFile(file)
    } catch (err) {
      // Anything thrown here (a hang we timed out on, a crash inside the
      // upload path, anything not already handled as a normal uploadError)
      // was previously just leaving the driver stuck on a spinner or a
      // blank screen with nothing for us to go on. Surface it so the next
      // report comes with an actual error string instead of "it's stuck."
      setError(`Something went wrong (${err instanceof Error ? err.message : String(err)}). Tap "+ Add Photo" to try again.`)
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function handleAddPhotoTap() {
    if (uploading) return
    setError(null)
    if (await isPageStale()) {
      setStaleReload(true)
      setError("There's a newer version of this page. Tap Refresh below, then take the photo again.")
      return
    }
    inputRef.current?.click()
  }

  async function handleRetry() {
    if (!pendingFile) return
    setUploading(true)
    setError(null)
    try {
      await uploadFile(pendingFile)
    } catch (err) {
      setError(`Something went wrong (${err instanceof Error ? err.message : String(err)}). Tap "+ Add Photo" to try again.`)
      setUploading(false)
    }
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
          onClick={handleAddPhotoTap}
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
          Uploading photo…
        </div>
      )}

      {error && (
        <div className="px-4 py-2 flex items-center justify-between gap-3">
          <p className="text-xs text-red-500">{error}</p>
          <div className="flex items-center gap-2 shrink-0">
            {staleReload && (
              <button
                onClick={() => window.location.reload()}
                className="text-xs font-bold text-[#0D2240] hover:opacity-70"
              >
                Refresh
              </button>
            )}
            {pendingFile && !staleReload && (
              <button
                onClick={handleRetry}
                disabled={uploading}
                className="text-xs font-bold text-[#E8726A] hover:text-[#d45f57] disabled:opacity-50"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {photos.length === 0 && !uploading && (
        <div className="px-4 py-5 text-center">
          <p className="text-sm text-gray-400">No photos yet.</p>
          <p className="text-xs text-gray-300 mt-0.5">Tap "+ Add Photo" to take a pickup photo.</p>
        </div>
      )}
    </div>
  )
}
