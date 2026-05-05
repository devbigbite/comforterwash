"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { uploadSiteImage, resetSiteImage } from "@/app/actions/settings"
import { SITE_IMAGE_SLOTS, DEFAULT_IMAGES, type SiteImages } from "@/lib/site-images-config"

export function SiteImagesEditor({ initialImages }: { initialImages: SiteImages }) {
  const [images, setImages] = useState<SiteImages>(initialImages)
  const [uploading, setUploading] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  async function handleUpload(key: string, file: File) {
    setUploading(key)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const url = await uploadSiteImage(key, formData)
      setImages(prev => ({ ...prev, [key]: url }))
      setSaved(key)
      setTimeout(() => setSaved(null), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(null)
    }
  }

  async function handleReset(key: string) {
    setUploading(key)
    setError(null)
    try {
      await resetSiteImage(key)
      setImages(prev => ({ ...prev, [key]: DEFAULT_IMAGES[key as keyof SiteImages] }))
      setSaved(key)
      setTimeout(() => setSaved(null), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed")
    } finally {
      setUploading(null)
    }
  }

  const isCustom = (key: string) =>
    images[key as keyof SiteImages] !== DEFAULT_IMAGES[key as keyof SiteImages]

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {SITE_IMAGE_SLOTS.map(slot => {
        const src = images[slot.key as keyof SiteImages]
        const busy = uploading === slot.key
        const done = saved === slot.key
        const custom = isCustom(slot.key)

        return (
          <div
            key={slot.key}
            className="rounded-2xl border-2 border-[#0D2240]/10 bg-white shadow-sm overflow-hidden"
          >
            {/* Preview */}
            <div className="relative w-full h-48 bg-gray-100">
              <Image
                src={src}
                alt={slot.label}
                fill
                className="object-cover"
                unoptimized={src.startsWith("http")}
              />
              {custom && (
                <span className="absolute top-3 left-3 bg-[#E8726A] text-white text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full">
                  Custom
                </span>
              )}
              {!custom && (
                <span className="absolute top-3 left-3 bg-black/40 text-white text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full">
                  Placeholder
                </span>
              )}
            </div>

            {/* Info + controls */}
            <div className="p-5">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="font-extrabold text-[#0D2240] text-sm">{slot.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{slot.description}</p>
                </div>
                {done && (
                  <span className="text-xs text-green-600 font-semibold mt-0.5">✓ Saved</span>
                )}
              </div>

              <p className="text-[10px] text-gray-300 font-mono mt-2 mb-4 truncate">
                {custom ? src.split("?")[0].split("/").pop() : slot.fallback}
              </p>

              <div className="flex items-center gap-3">
                {/* Hidden file input */}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  ref={el => { fileRefs.current[slot.key] = el }}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(slot.key, file)
                    e.target.value = ""
                  }}
                />

                <button
                  onClick={() => fileRefs.current[slot.key]?.click()}
                  disabled={busy}
                  className="flex-1 bg-[#0D2240] hover:bg-[#1a3a5c] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 uppercase tracking-wide"
                >
                  {busy ? "Uploading…" : "Upload New Image"}
                </button>

                {custom && (
                  <button
                    onClick={() => handleReset(slot.key)}
                    disabled={busy}
                    className="text-xs text-gray-400 hover:text-red-500 font-semibold px-3 py-2.5 rounded-xl border border-gray-200 hover:border-red-300 transition-colors disabled:opacity-50"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}

      <p className="text-xs text-gray-400 text-center pt-2">
        JPG, PNG or WebP · Max 5 MB per image · Changes go live instantly
      </p>
    </div>
  )
}
