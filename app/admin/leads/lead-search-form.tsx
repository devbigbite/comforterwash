"use client"

import { useState, useEffect, useRef } from "react"
import { startLeadSearch, checkLeadSearchStatus, type LeadSearch } from "@/app/actions/leads"

const STATUS_BADGE: Record<string, string> = {
  queued:     "bg-gray-100 text-gray-500 border border-gray-200",
  processing: "bg-blue-50 text-blue-700 border border-blue-200",
  completed:  "bg-green-50 text-green-700 border border-green-200",
  failed:     "bg-red-50 text-red-700 border border-red-200",
}

const STATUS_LABEL: Record<string, string> = {
  queued:     "Queued",
  processing: "Searching…",
  completed:  "Done",
  failed:     "Failed",
}

// Suggested categories — just a convenience row of buttons that fill in the
// category field, not a fixed list. Any free text can be typed instead.
const SUGGESTED_CATEGORIES = [
  "local spas", "gyms", "Airbnb property managers", "mom groups",
  "hair salons", "hotels", "senior living communities", "real estate agents",
]

export function LeadSearchForm({ initialSearches }: { initialSearches: LeadSearch[] }) {
  const [category, setCategory]     = useState("")
  const [geoArea, setGeoArea]       = useState("")
  const [numResults, setNumResults] = useState(10)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [searches, setSearches]     = useState(initialSearches)
  const pollTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Resume polling for any search that was still in flight on page load
  // (e.g. the admin navigated away and came back).
  useEffect(() => {
    for (const s of initialSearches) {
      if (s.status === "queued" || s.status === "processing") pollSearch(s.id)
    }
    return () => {
      for (const t of Object.values(pollTimers.current)) clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function pollSearch(searchId: string) {
    const tick = async () => {
      const result = await checkLeadSearchStatus(searchId)
      setSearches(prev => prev.map(s => s.id === searchId ? { ...s, status: result.status, error: result.error ?? null } : s))
      if (result.status === "queued" || result.status === "processing") {
        pollTimers.current[searchId] = setTimeout(tick, 4000)
      } else {
        delete pollTimers.current[searchId]
        if (result.status === "completed") {
          // Refresh the page data (new leads) without losing form state.
          window.location.reload()
        }
      }
    }
    pollTimers.current[searchId] = setTimeout(tick, 3000)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = await startLeadSearch(category, geoArea, numResults)
    setSubmitting(false)
    if ("error" in result) {
      setError(result.error)
      return
    }
    setSearches(prev => [
      { id: result.searchId, category, geo_area: geoArea, num_results: numResults, status: "queued", error: null, created_at: new Date().toISOString(), completed_at: null, lead_count: 0 },
      ...prev,
    ])
    setCategory("")
    setGeoArea("")
    pollSearch(result.searchId)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <form onSubmit={handleSubmit} className="grid sm:grid-cols-[1.2fr_1fr_auto_auto] gap-3 items-end">
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Lead category</label>
          <input
            type="text"
            value={category}
            onChange={e => setCategory(e.target.value)}
            placeholder="e.g. local spas"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#0D2240] focus:ring-2 focus:ring-[#0D2240]/10"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Geographic area</label>
          <input
            type="text"
            value={geoArea}
            onChange={e => setGeoArea(e.target.value)}
            placeholder="e.g. Orlando, FL"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#0D2240] focus:ring-2 focus:ring-[#0D2240]/10"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide"># results</label>
          <input
            type="number"
            min={3}
            max={20}
            value={numResults}
            onChange={e => setNumResults(Number(e.target.value))}
            className="w-20 px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#0D2240] focus:ring-2 focus:ring-[#0D2240]/10"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-50 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap"
        >
          {submitting ? "Starting…" : "Find Leads"}
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {SUGGESTED_CATEGORIES.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className="text-xs font-semibold text-gray-500 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full px-2.5 py-1 transition-colors"
          >
            {c}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 font-medium mt-3">{error}</p>}

      {searches.length > 0 && (
        <div className="mt-5 pt-5 border-t border-gray-100 space-y-2">
          {searches.slice(0, 8).map(s => (
            <div key={s.id} className="flex items-center justify-between text-sm gap-3">
              <div className="min-w-0">
                <span className="font-semibold text-[#0D2240]">{s.category}</span>
                <span className="text-gray-400"> in {s.geo_area} · {s.num_results} results</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s.status === "completed" && <span className="text-xs text-gray-400">{s.lead_count} leads</span>}
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_BADGE[s.status]}`}>
                  {STATUS_LABEL[s.status]}
                </span>
              </div>
            </div>
          ))}
          {searches.some(s => s.status === "failed" && s.error) && (
            <p className="text-xs text-red-500 mt-1">
              {searches.find(s => s.status === "failed")?.error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
