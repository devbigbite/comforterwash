"use client"

import { useState } from "react"

// ────────────────────────────────────────────────────────────────
// Circular ("clock face") time picker — replaces a raw text/number
// time input with the same two-step hour-then-minute dial pattern as
// Android/Material's native time picker (what showed up in the
// reference screenshot). Click an hour, it auto-advances to minutes;
// click a minute (5-min increments) and Apply.
// ─────────────────────────────────────────────────────────────────

export interface CircularTimeValue {
  hour: number    // 1-12
  minute: number  // 0-59
  ampm: "AM" | "PM"
}

export function timeValueTo24h(v: CircularTimeValue): { hour24: number; minute: number } {
  let hour24 = v.hour % 12
  if (v.ampm === "PM") hour24 += 12
  return { hour24, minute: v.minute }
}

export function timeValueFrom24h(hour24: number, minute: number): CircularTimeValue {
  const ampm: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM"
  let hour = hour24 % 12
  if (hour === 0) hour = 12
  return { hour, minute, ampm }
}

const HOUR_MARKS = Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i))
const MINUTE_MARKS = Array.from({ length: 12 }, (_, i) => i * 5)

// Point on the clock face for a given "step" out of 12, at radius r,
// centered at (cx, cy). Step 0 = 12 o'clock position, going clockwise.
function pointOnClock(step: number, cx: number, cy: number, r: number) {
  const angle = (step / 12) * 2 * Math.PI - Math.PI / 2
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
}

export function CircularTimePicker({
  initial,
  onApply,
  onCancel,
}: {
  initial: CircularTimeValue
  onApply: (v: CircularTimeValue) => void
  onCancel: () => void
}) {
  const [mode, setMode] = useState<"hour" | "minute">("hour")
  const [value, setValue] = useState<CircularTimeValue>(initial)

  const size = 240
  const cx = size / 2
  const cy = size / 2
  const r = 92

  const activeStep = mode === "hour"
    ? (value.hour % 12)
    : Math.round(value.minute / 5) % 12
  const handPoint = pointOnClock(activeStep, cx, cy, r)

  function pickHour(h: number) {
    setValue(v => ({ ...v, hour: h }))
    setMode("minute")
  }
  function pickMinute(m: number) {
    setValue(v => ({ ...v, minute: m }))
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-[280px]">
      {/* Digital readout header */}
      <div className="bg-[#0D2240] px-5 py-4 flex items-center justify-between">
        <div className="flex items-baseline gap-1">
          <button
            onClick={() => setMode("hour")}
            className={`text-3xl font-extrabold tabular-nums transition-opacity ${mode === "hour" ? "text-white" : "text-white/50"}`}
          >{String(value.hour).padStart(2, "0")}</button>
          <span className="text-3xl font-extrabold text-white/50">:</span>
          <button
            onClick={() => setMode("minute")}
            className={`text-3xl font-extrabold tabular-nums transition-opacity ${mode === "minute" ? "text-white" : "text-white/50"}`}
          >{String(value.minute).padStart(2, "0")}</button>
        </div>
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => setValue(v => ({ ...v, ampm: "AM" }))}
            className={`text-[10px] font-extrabold px-2 py-0.5 rounded transition-colors ${value.ampm === "AM" ? "bg-white text-[#0D2240]" : "text-white/60"}`}
          >AM</button>
          <button
            onClick={() => setValue(v => ({ ...v, ampm: "PM" }))}
            className={`text-[10px] font-extrabold px-2 py-0.5 rounded transition-colors ${value.ampm === "PM" ? "bg-white text-[#0D2240]" : "text-white/60"}`}
          >PM</button>
        </div>
      </div>

      {/* Clock face */}
      <div className="p-5 flex justify-center">
        <svg width={size} height={size} className="select-none">
          <circle cx={cx} cy={cy} r={r + 22} fill="#f7f8fb" />
          {/* Hand */}
          <line x1={cx} y1={cy} x2={handPoint.x} y2={handPoint.y} stroke="#0D2240" strokeWidth={2} />
          <circle cx={cx} cy={cy} r={4} fill="#0D2240" />
          <circle cx={handPoint.x} cy={handPoint.y} r={16} fill="#0D2240" />

          {mode === "hour"
            ? HOUR_MARKS.map(h => {
                const step = h % 12
                const p = pointOnClock(step, cx, cy, r)
                const selected = value.hour === h
                return (
                  <g key={h} onClick={() => pickHour(h)} className="cursor-pointer">
                    <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
                    <text
                      x={p.x} y={p.y + 4} textAnchor="middle"
                      className={`text-sm font-bold select-none ${selected ? "fill-white" : "fill-[#0D2240]"}`}
                    >{h}</text>
                  </g>
                )
              })
            : MINUTE_MARKS.map(m => {
                const step = m / 5
                const p = pointOnClock(step, cx, cy, r)
                const selected = Math.round(value.minute / 5) * 5 === m
                return (
                  <g key={m} onClick={() => pickMinute(m)} className="cursor-pointer">
                    <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
                    <text
                      x={p.x} y={p.y + 4} textAnchor="middle"
                      className={`text-sm font-bold select-none ${selected ? "fill-white" : "fill-[#0D2240]"}`}
                    >{String(m).padStart(2, "0")}</text>
                  </g>
                )
              })}
        </svg>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 px-5 pb-4">
        <button onClick={onCancel} className="text-gray-500 font-bold text-sm px-4 py-2 rounded-lg hover:bg-gray-50">Cancel</button>
        <button onClick={() => onApply(value)} className="bg-[#0D2240] text-white font-bold text-sm px-4 py-2 rounded-lg hover:bg-[#0a1a33]">Apply</button>
      </div>
    </div>
  )
}
