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

const TZ_LABELS: Record<string, string> = {
  "America/New_York": "Eastern Time",
  "America/Chicago": "Central Time",
  "America/Denver": "Mountain Time",
  "America/Phoenix": "Mountain Time (no DST)",
  "America/Los_Angeles": "Pacific Time",
  "America/Anchorage": "Alaska Time",
}

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
type SupportHoursValue = { enabled: boolean; hours: WeekHours }

async function saveSupportHours(value: SupportHoursValue) {
  const res = await fetch("/api/admin/support-hours", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  })
  if (!res.ok) throw new Error("Failed to save")
}

interface Props {
  initialEnabled: boolean
  initialHours: WeekHours | null
  timezone: string
}

// "Customer Service Hours" -- formerly "Platform Operating Hours." This is
// purely informational: when a tenant is available to answer calls, texts,
// and live chat. It does NOT gate the booking calendar -- customers can
// always book online 24/7, regardless of what's set here. Date blocking
// lives entirely in the separate "Quick-add Holidays" / custom date-range
// section below, via holiday_exclusions (see app/actions/holidays.ts), and
// pickup/delivery timing is a driver-routing concern, not a booking-hours
// concern. Kept off by default (`enabled: false`) since most tenants don't
// staff live support on a schedule -- a tenant that does can turn it on
// without affecting anyone else's booking flow.
export function SupportHoursEditor({ initialEnabled, initialHours, timezone }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [hours, setHours] = useState<WeekHours>(initialHours ?? DEFAULT_HOURS)
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle")

  const tzLabel = TZ_LABELS[timezone] ?? timezone

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
        await saveSupportHours({ enabled, hours })
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
        <h2 className="font-extrabold text-[#0D2240] text-sm uppercase tracking-wide">Customer Service Hours</h2>
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
      <p className="text-xs text-gray-400 mb-4">
        When you're available to answer calls, texts, and live chat — like office hours. This does{" "}
        <strong className="text-gray-500">not</strong> affect the booking calendar; customers can always book online
        any day, any time. Pickup and delivery windows are set by your routes, separately.
      </p>

      {/* Feature on/off — most tenants won't staff live support on a fixed
          schedule, so this stays off (and the day rows hidden) until a
          tenant opts in. */}
      <button
        type="button"
        onClick={() => { setEnabled(e => !e); setStatus("idle") }}
        className={`flex items-center gap-3 rounded-xl px-4 py-3 mb-4 w-full text-left transition-colors ${
          enabled ? "bg-[#f7f8fb]" : "bg-gray-50"
        }`}
      >
        <span
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
            enabled ? "bg-[#E8726A]" : "bg-gray-200"
          }`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-4.5" : "translate-x-0.5"
          }`} />
        </span>
        <span className="text-sm font-bold text-[#0D2240]">
          {enabled ? "Showing customer service hours" : "Not using customer service hours"}
        </span>
      </button>

      {enabled && (
        <>
          {openDays.length > 0 && (
            <p className="text-xs text-[#0D2240] font-semibold mb-3">
              Currently available: {openDays.map(d => d.label.slice(0, 3)).join(", ")}
            </p>
          )}
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
                      <span className="text-[10px] text-gray-400 ml-1">{tzLabel}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300 font-semibold">Closed</span>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
