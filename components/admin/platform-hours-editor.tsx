"use client"

import { useState, useTransition } from "react"

const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
]

const DEFAULT_HOURS = {
  mon: { open: true,  start: "08:00", end: "18:00" },
  tue: { open: true,  start: "08:00", end: "18:00" },
  wed: { open: true,  start: "08:00", end: "18:00" },
  thu: { open: false, start: "08:00", end: "18:00" },
  fri: { open: false, start: "08:00", end: "18:00" },
  sat: { open: false, start: "08:00", end: "18:00" },
  sun: { open: false, start: "08:00", end: "18:00" },
}

type DayHours = { open: boolean; start: string; end: string }
type WeekHours = Record<string, DayHours>

async function savePlatformHours(hours: WeekHours) {
  const res = await fetch("/api/admin/platform-hours", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(hours),
  })
  if (!res.ok) throw new Error("Failed to save")
}

interface Props {
  initialHours: WeekHours | null
}

export function PlatformHoursEditor({ initialHours }: Props) {
  const [hours, setHours] = useState<WeekHours>(initialHours ?? DEFAULT_HOURS)
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle")

  function update(day: string, field: keyof DayHours, value: boolean | string) {
    setHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }))
    setStatus("idle")
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await savePlatformHours(hours)
        setStatus("saved")
        setTimeout(() => setStatus("idle"), 3000)
      } catch {
        setStatus("error")
      }
    })
  }

  const openDays = DAYS.filter(d => hours[d.key]?.open)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-extrabold text-[#0D2240] text-sm uppercase tracking-wide">Platform Operating Hours</h2>
        <div className="flex items-center gap-3">
          {status === "saved" && <span className="text-xs text-green-600 font-semibold">✓ Saved</span>}
          {status === "error" && <span className="text-xs text-red-500 font-semibold">Save failed</span>}
          <button
            onClick={handleSave}
            disabled={isPending}
            className="bg-[#0D2240] hover:bg-[#1a3a5c] disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors uppercase tracking-wide"
          >
            {isPending ? "Saving…" : "Save Hours"}
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-5">
        Controls which days customers can book pickups and deliveries.
        {openDays.length > 0 && (
          <span className="ml-1 text-[#0D2240] font-semibold">
            Currently open: {openDays.map(d => d.label.slice(0, 3)).join(", ")}
          </span>
        )}
      </p>

      <div className="space-y-2">
        {DAYS.map(({ key, label }) => {
          const day = hours[key] ?? { open: false, start: "08:00", end: "18:00" }
          return (
            <div
              key={key}
              className={`flex items-center gap-4 rounded-xl px-4 py-3 transition-colors ${
                day.open ? "bg-[#f7f8fb]" : "bg-gray-50"
              }`}
            >
              {/* Toggle */}
              <button
                type="button"
                onClick={() => update(key, "open", !day.open)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                  day.open ? "bg-[#E8726A]" : "bg-gray-200"
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  day.open ? "translate-x-4.5" : "translate-x-0.5"
                }`} />
              </button>

              {/* Day label */}
              <span className={`w-24 text-sm font-bold ${day.open ? "text-[#0D2240]" : "text-gray-300"}`}>
                {label}
              </span>

              {/* Hours — only when open */}
              {day.open ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={day.start}
                    onChange={e => update(key, "start", e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-[#0D2240] focus:outline-none focus:border-[#E8726A] bg-white"
                  />
                  <span className="text-gray-300 text-xs font-bold">to</span>
                  <input
                    type="time"
                    value={day.end}
                    onChange={e => update(key, "end", e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-[#0D2240] focus:outline-none focus:border-[#E8726A] bg-white"
                  />
                  <span className="text-[10px] text-gray-400 ml-1">Eastern Time</span>
                </div>
              ) : (
                <span className="text-xs text-gray-300 font-semibold">Closed</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
