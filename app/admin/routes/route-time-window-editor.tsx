"use client"

import { useState, useTransition } from "react"
import { createRouteTimeWindow, deleteRouteTimeWindow } from "@/app/actions/routes"
import type { TimeWindow } from "@/lib/route-availability"

// Format "09:00" → "9:00 AM", "13:00" → "1:00 PM"
function fmt24(t: string): string {
  const [hStr, mStr] = t.split(":")
  const h = parseInt(hStr, 10)
  const m = mStr ?? "00"
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${m} ${ampm}`
}

function buildLabel(start: string, end: string): string {
  return `${fmt24(start)} – ${fmt24(end)}`
}

// Hour slots for the picker (1-hour increments)
const HOURS = Array.from({ length: 24 }, (_, i) => {
  const hh = String(i).padStart(2, "0")
  return { value: `${hh}:00`, label: fmt24(`${hh}:00`) }
})

interface Props {
  routeId: string
  initialWindows: TimeWindow[]
}

export function RouteTimeWindowEditor({ routeId, initialWindows }: Props) {
  const [windows, setWindows] = useState<TimeWindow[]>(initialWindows)
  const [adding, setAdding] = useState(false)
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("13:00")
  const [maxBookings, setMaxBookings] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function resetForm() {
    setStartTime("09:00")
    setEndTime("13:00")
    setMaxBookings("")
    setIsPrivate(false)
    setError("")
    setAdding(false)
  }

  function handleAdd() {
    if (startTime >= endTime) {
      setError("End time must be after start time.")
      return
    }
    setError("")
    startTransition(async () => {
      const label = buildLabel(startTime, endTime)
      const max = maxBookings ? parseInt(maxBookings, 10) : null
      const result = await createRouteTimeWindow(routeId, startTime, endTime, label, max, isPrivate)
      if (result.error) {
        setError(result.error)
        return
      }
      // Optimistic update
      setWindows(prev => [...prev, {
        id: crypto.randomUUID(),
        route_id: routeId,
        start_time: startTime,
        end_time: endTime,
        label,
        max_bookings: max,
        is_private: isPrivate,
        sort_order: prev.length,
      }])
      resetForm()
    })
  }

  function handleDelete(windowId: string) {
    startTransition(async () => {
      await deleteRouteTimeWindow(windowId)
      setWindows(prev => prev.filter(w => w.id !== windowId))
    })
  }

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
          Time Windows ({windows.length})
        </p>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-[10px] font-bold text-[#E8726A] border border-[#E8726A] px-3 py-1 rounded-lg hover:bg-[#fdf6f3] transition-colors uppercase tracking-wide"
          >
            + Add Window
          </button>
        )}
      </div>

      {/* Existing windows */}
      {windows.length === 0 && !adding && (
        <p className="text-xs text-gray-400 italic">
          No windows set — booking forms will use the platform default (9am–1pm, 3pm–7pm).
        </p>
      )}

      <div className="space-y-1.5 mb-3">
        {windows.map(w => (
          <div key={w.id} className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-3 py-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-[#0D2240]">{w.label}</span>
              {w.is_private && (
                <span className="text-[9px] font-bold text-purple-600 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-full uppercase">Private</span>
              )}
              {w.max_bookings && (
                <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">
                  Max {w.max_bookings}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleDelete(w.id)}
              disabled={isPending}
              className="text-[10px] text-red-400 hover:text-red-600 font-bold border border-red-100 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg transition-colors uppercase disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Add form */}
      {adding && (
        <div className="bg-[#f7f8fb] rounded-2xl border border-gray-200 p-4 space-y-3">
          <p className="text-xs font-bold text-[#0D2240] uppercase tracking-wide">New Time Window</p>

          {/* Hour block grid — visual like Curbside */}
          <div>
            <p className="text-[10px] text-gray-400 mb-2 font-semibold uppercase tracking-wide">Select hours (click to toggle)</p>
            <HourRangePicker
              startTime={startTime}
              endTime={endTime}
              onStartChange={setStartTime}
              onEndChange={setEndTime}
            />
          </div>

          {/* Preview label */}
          {startTime < endTime && (
            <div className="text-xs font-semibold text-[#0D2240] bg-white rounded-xl px-3 py-2 border border-gray-200">
              Window: <span className="text-[#E8726A]">{buildLabel(startTime, endTime)}</span>
            </div>
          )}

          {/* Options row */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">
                Max Bookings <span className="font-normal">(blank = unlimited)</span>
              </label>
              <input
                type="number"
                min="1"
                value={maxBookings}
                onChange={e => setMaxBookings(e.target.value)}
                placeholder="Unlimited"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A] bg-white"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer mt-4">
              <button
                type="button"
                onClick={() => setIsPrivate(p => !p)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none ${isPrivate ? "bg-purple-500" : "bg-gray-200"}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${isPrivate ? "translate-x-4.5" : "translate-x-0.5"}`} />
              </button>
              <span className="text-xs font-semibold text-gray-600">Private</span>
            </label>
          </div>

          {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 text-xs font-bold text-gray-500 border border-gray-200 bg-white px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors uppercase tracking-wide"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={isPending || startTime >= endTime}
              className="flex-[2] text-xs font-bold text-white bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 px-4 py-2 rounded-xl transition-colors uppercase tracking-wide"
            >
              {isPending ? "Saving…" : "Save Window"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Hour Range Picker ────────────────────────────────────────────────────────

function HourRangePicker({
  startTime, endTime, onStartChange, onEndChange,
}: {
  startTime: string; endTime: string
  onStartChange: (t: string) => void; onEndChange: (t: string) => void
}) {
  const startH = parseInt(startTime.split(":")[0], 10)
  const endH   = parseInt(endTime.split(":")[0], 10)

  // Show 6am–10pm (hours 6–22)
  const visibleHours = HOURS.filter(h => {
    const hNum = parseInt(h.value.split(":")[0], 10)
    return hNum >= 6 && hNum <= 22
  })

  function handleClick(hour: number) {
    // If clicking before current start — set as new start
    if (hour < startH) {
      onStartChange(String(hour).padStart(2, "0") + ":00")
      return
    }
    // If clicking after current end — set as new end
    if (hour >= endH) {
      onEndChange(String(hour + 1).padStart(2, "0") + ":00")
      return
    }
    // If clicking within — split: drag start or drag end
    // Simple logic: if closer to start, move start; otherwise move end
    if (hour - startH < endH - hour) {
      onStartChange(String(hour).padStart(2, "0") + ":00")
    } else {
      onEndChange(String(hour + 1).padStart(2, "0") + ":00")
    }
  }

  return (
    <div className="flex flex-wrap gap-1">
      {visibleHours.map(h => {
        const hNum = parseInt(h.value.split(":")[0], 10)
        const inRange = hNum >= startH && hNum < endH
        return (
          <button
            key={h.value}
            type="button"
            onClick={() => handleClick(hNum)}
            className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
              inRange
                ? "bg-[#0D2240] text-white"
                : "bg-white border border-gray-200 text-gray-400 hover:border-[#0D2240] hover:text-[#0D2240]"
            }`}
          >
            {h.label}
          </button>
        )
      })}
    </div>
  )
}
