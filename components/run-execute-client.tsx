"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { completeTransportRun } from "@/app/actions/transport-runs"
import type { TransportRun, RunOrder } from "@/app/actions/transport-runs"

interface Props {
  run: TransportRun
  orders: RunOrder[]
  role: "driver" | "operator"
}

export default function RunExecuteClient({ run, orders, role }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [workerName, setWorkerName] = useState(run.assigned_to ?? "")
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [executeError, setExecuteError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const isToFacility = run.run_type === "to_facility"
  const homePath = role === "driver" ? "/driver" : "/operator"

  const runLabel      = isToFacility ? "Storage → Facility" : "Facility → Storage"
  const runIcon       = isToFacility ? "🏭" : "📦"
  const accentColor   = isToFacility ? "bg-purple-500/20 border-purple-500/30 text-purple-300" : "bg-amber-500/20 border-amber-500/30 text-amber-300"
  const buttonColor   = isToFacility ? "bg-purple-500 hover:bg-purple-400" : "bg-amber-500 hover:bg-amber-400"
  const actionLabel   = isToFacility ? "Confirm Arrival at Facility" : "Confirm Return to Storage"

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadError(null)

    const supabase = createClient()
    const safeName = file.name.replace(/[^a-z0-9.]/gi, "_").toLowerCase()
    const path = `runs/${run.id}/${Date.now()}-${safeName}`

    const { error: uploadErr } = await supabase.storage
      .from("order-photos")
      .upload(path, file, { upsert: false })

    if (uploadErr) {
      setUploadError(uploadErr.message)
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from("order-photos")
      .getPublicUrl(path)

    setPhotoUrl(publicUrl)
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleExecute() {
    if (!workerName.trim()) {
      setExecuteError("Enter your name before executing the run.")
      return
    }
    if (!photoUrl) {
      setExecuteError("A photo is required to complete this run.")
      return
    }

    setExecuting(true)
    setExecuteError(null)

    const fd = new FormData()
    fd.append("runId",      run.id)
    fd.append("workerName", workerName.trim())
    fd.append("photoUrl",   photoUrl)

    const result = await completeTransportRun(fd)

    if (result?.error) {
      setExecuteError(result.error)
      setExecuting(false)
      return
    }

    setDone(true)
    setTimeout(() => router.push(homePath), 1800)
  }

  // ── Success screen ────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-[#0D2240] flex flex-col items-center justify-center px-4 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-extrabold text-white mb-2">Run Complete!</h2>
        <p className="text-white/50 text-sm">
          {orders.length} order{orders.length !== 1 ? "s" : ""} advanced.
        </p>
        <p className="text-white/30 text-xs mt-4">Returning to home…</p>
      </div>
    )
  }

  // ── Already completed / cancelled ────────────────────────────────
  if (run.status !== "pending") {
    return (
      <div className="min-h-screen bg-[#0D2240] flex flex-col items-center justify-center px-4 text-center">
        <div className="text-5xl mb-4">{run.status === "completed" ? "✅" : "🚫"}</div>
        <h2 className="text-xl font-extrabold text-white mb-2 capitalize">{run.status}</h2>
        <p className="text-white/40 text-sm mb-6">
          {run.status === "completed"
            ? `Completed by ${run.completed_by ?? "unknown"}.`
            : "This run was cancelled."}
        </p>
        <button
          onClick={() => router.push(homePath)}
          className="bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-3 rounded-2xl transition-colors"
        >
          ← Back to Home
        </button>
      </div>
    )
  }

  // ── Main execute UI ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0D2240]">

      {/* Header */}
      <div className="px-4 pt-10 pb-5">
        <button
          onClick={() => router.push(homePath)}
          className="text-white/40 text-sm hover:text-white/70 transition-colors mb-5 flex items-center gap-1"
        >
          ← Back
        </button>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-2xl shrink-0">
            {runIcon}
          </div>
          <div>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Facility Transfer</p>
            <h1 className="text-white font-extrabold text-lg leading-tight">{runLabel}</h1>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-4 pb-10 max-w-sm mx-auto">

        {/* Run details card */}
        <div className={`rounded-2xl border px-4 py-3 space-y-1.5 text-sm ${accentColor}`}>
          <div className="flex justify-between">
            <span className="opacity-60">Facility</span>
            <span className="font-semibold">{run.facility_name ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-60">Assigned to</span>
            <span className="font-semibold">{run.assigned_to}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-60">Orders</span>
            <span className="font-semibold">{orders.length}</span>
          </div>
          {run.notes && (
            <div className="pt-1 border-t border-current/20 opacity-70 text-xs">{run.notes}</div>
          )}
        </div>

        {/* Orders list */}
        <div>
          <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2">
            📦 Orders in this run
          </p>
          <div className="space-y-2">
            {orders.map(o => (
              <div
                key={o.id}
                className="bg-white/8 rounded-2xl px-4 py-3 flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{o.customer_name}</p>
                  <p className="text-white/40 text-xs truncate mt-0.5">{o.customer_address}</p>
                  <p className="text-white/30 text-xs mt-0.5">
                    {o.num_bags ?? "?"} bag{o.num_bags !== 1 ? "s" : ""} · {o.service_type === "wash_fold" ? "Wash & Fold" : "Comforter"}
                  </p>
                </div>
                <span className="text-white/50 font-mono text-xs tracking-widest shrink-0">
                  {o.short_code ?? o.id.slice(0, 6).toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Worker name */}
        <div className="bg-white rounded-2xl p-4">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
            Your name
          </label>
          <input
            type="text"
            value={workerName}
            onChange={e => setWorkerName(e.target.value)}
            placeholder="Enter your name"
            className="w-full border-2 border-gray-200 focus:border-[#0D2240] rounded-xl px-3 py-2.5 text-[#0D2240] font-semibold text-sm outline-none transition-colors"
          />
        </div>

        {/* Photo capture */}
        <div className="bg-white rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-[#0D2240] text-sm">📷 Run Photo</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {photoUrl ? "Photo captured ✓" : "Required — take a photo of the bags"}
              </p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors"
            >
              {uploading ? "Uploading…" : photoUrl ? "Retake" : "+ Take Photo"}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            className="hidden"
          />

          {uploadError && (
            <p className="px-4 py-2 text-xs text-red-500">{uploadError}</p>
          )}

          {photoUrl ? (
            <div className="p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt="Run photo"
                className="w-full rounded-xl object-cover max-h-48 border border-gray-100"
              />
            </div>
          ) : !uploading ? (
            <div className="px-4 py-5 text-center">
              <p className="text-sm text-gray-400">No photo yet.</p>
              <p className="text-xs text-gray-300 mt-0.5">Tap "+ Take Photo" to use your camera.</p>
            </div>
          ) : (
            <div className="px-4 py-3 flex items-center gap-2 text-sm text-gray-500">
              <div className="w-4 h-4 border-2 border-[#E8726A] border-t-transparent rounded-full animate-spin" />
              Uploading…
            </div>
          )}
        </div>

        {/* Error */}
        {executeError && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-2xl px-4 py-3">
            <p className="text-red-300 text-sm font-semibold">{executeError}</p>
          </div>
        )}

        {/* Execute button */}
        <button
          onClick={handleExecute}
          disabled={executing || uploading || !photoUrl || !workerName.trim()}
          className={`w-full ${buttonColor} disabled:opacity-40 text-white font-extrabold text-base py-5 rounded-2xl transition-colors shadow-lg`}
        >
          {executing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Executing…
            </span>
          ) : (
            `${runIcon} ${actionLabel}`
          )}
        </button>

        <p className="text-white/25 text-xs text-center leading-relaxed">
          This will move all {orders.length} order{orders.length !== 1 ? "s" : ""} to{" "}
          {isToFacility ? "Intake at the facility" : "At Storage"}<br />
          and mark this transfer complete.
        </p>
      </div>
    </div>
  )
}
