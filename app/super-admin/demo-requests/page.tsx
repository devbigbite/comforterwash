"use client"

import { useEffect, useState, useTransition } from "react"
import {
  getPlatformDemoRequests,
  setDemoRequestStatus,
  type PlatformDemoRequest,
} from "@/app/actions/platform-demo-requests"

const STATUS_COLORS: Record<string, string> = {
  new:       "bg-indigo-100 text-indigo-700",
  contacted: "bg-amber-100 text-amber-700",
  closed:    "bg-slate-100 text-slate-500",
}

const STATUS_CYCLE: Record<string, "new" | "contacted" | "closed"> = {
  new: "contacted",
  contacted: "closed",
  closed: "new",
}

export default function DemoRequestsPage() {
  const [requests, setRequests] = useState<PlatformDemoRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [, startTransition] = useTransition()

  async function load() {
    setLoading(true)
    const data = await getPlatformDemoRequests()
    setRequests(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function cycleStatus(r: PlatformDemoRequest) {
    const next = STATUS_CYCLE[r.status]
    await setDemoRequestStatus(r.id, next)
    startTransition(() => { load() })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-sm">
        Loading demo requests…
      </div>
    )
  }

  const newCount = requests.filter(r => r.status === "new").length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Demo Requests</h2>
        <p className="text-sm text-slate-500 mt-1">
          {requests.length} total{newCount > 0 ? ` · ${newCount} new` : ""} — submitted via the "Request a Demo" form on /platform
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
          No demo requests yet.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900">{r.name}</span>
                  {r.business && <span className="text-slate-400 text-sm">— {r.business}</span>}
                  <button
                    onClick={() => cycleStatus(r)}
                    title="Click to change status"
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${STATUS_COLORS[r.status] ?? STATUS_COLORS.new}`}
                  >
                    {r.status}
                  </button>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  <a href={`mailto:${r.email}`} className="hover:underline">{r.email}</a>
                  {r.phone && <> · <a href={`tel:${r.phone}`} className="hover:underline">{r.phone}</a></>}
                </p>
                {r.message && (
                  <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap bg-slate-50 rounded-lg px-3 py-2">{r.message}</p>
                )}
                <p className="text-xs text-slate-300 mt-2">
                  {new Date(r.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
