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

// Time options in 30-minute increments from 6:00 AM to 11:00 PM
const TIME_OPTIONS = Array.from({ length: 35 }, (_, i) => {
  const totalMins = 360 + i * 30  // start at 6:00 AM (360 min)
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
  return { value, label: fmt24(value) }
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
        <div className="bg-[#f7f8fb] rounded-2xl border border-gray-200 p-4 space-y-4">
          <p className="text-xs font-bold text-[#0D2240] uppercase tracking-wide">New Time Window</p>

          {/* Start / End time dropdowns */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Start Time</label>
              <select
                value={startTime}
                onChange={e => {
                  setStartTime(e.target.value)
                  setError("")
                }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A] bg-white"
              >
                {TIME_OPTIONS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">End Time</label>
              <select
                value={endTime}
                onChange={e => {
                  setEndTime(e.target.value)
                  setError("")
                }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A] bg-white"
              >
                {TIME_OPTIONS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Visual preview bar */}
          {startTime < endTime && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Preview</p>
              <TimeRangeBar startTime={startTime} endTime={endTime} />
              <p className="text-xs font-semibold text-[#0D2240] mt-2">
                Window: <span className="text-[#E8726A]">{buildLabel(startTime, endTime)}</span>
              </p>
            </div>
          )}

          {/* Max bookings + private toggle */}
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
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${isPrivate ? "translate-x-[18px]" : "translate-x-0.5"}`} />
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

// ── Visual preview bar ───────────────────────────────────────────────────────

function TimeRangeBar({ startTime, endTime }: { startTime: string; endTime: string }) {
  // Show 6 AM to 11 PM = 17 hours total
  const DAY_START = 6   // 6 AM
  const DAY_END   = 23  // 11 PM
  const totalHours = DAY_END - DAY_START

  const startH = parseFloat(startTime.replace(":", "."))
    - parseFloat(startTime.split(":")[1]) / 60
    + parseInt(startTime.split(":")[0])
    - DAY_START
  const endH = parseInt(endTime.split(":")[0]) + parseInt(endTime.split(":")[1]) / 60 - DAY_START

  // Simpler: just use hour numbers
  const sH = parseInt(startTime.split(":")[0]) + parseInt(startTime.split(":")[1]) / 60
  const eH = parseInt(endTime.split(":")[0])   + parseInt(endTime.split(":")[1]) / 60
  const leftPct  = ((sH - DAY_START) / totalHours) * 100
  const widthPct = ((eH - sH) / totalHours) * 100

  const hourMarkers = Array.from({ length: totalHours + 1 }, (_, i) => DAY_START + i)

  return (
    <div className="relative h-8 bg-gray-100 rounded-xl overflow-hidden">
      {/* Selected range */}
      <div
        className="absolute top-0 h-full bg-[#0D2240] rounded-xl transition-all"
        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
      />
      {/* Hour markers */}
      {hourMarkers.filter(h => h % 3 === 0).map(h => (
        <div
          key={h}
          className="absolute top-0 h-full flex items-center"
          style={{ left: `${((h - DAY_START) / totalHours) * 100}%` }}
        >
          <span className="text-[8px] font-bold text-white/60 pl-0.5 leading-none select-none z-10 relative">
            {h > 12 ? `${h - 12}P` : h === 12 ? "12P" : `${h}A`}
          </span>
        </div>
      ))}
    </div>
  )
}
