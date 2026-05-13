"use client"

import { useState, useTransition } from "react"
import { addStorageEntryWindow, deleteStorageEntryWindow } from "@/app/actions/storage-windows"

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
const DAY_SHORT = ["S","M","T","W","T","F","S"]

export interface StorageEntryWindow {
  id: string
  storage_space_id: string
  label: string | null
  days_of_week: number[]
  start_time: string
  end_time: string
  overnight: boolean
  notes: string | null
}

function fmt(t: string) {
  if (!t) return ""
  const [h, m] = t.split(":")
  const hr = parseInt(h)
  const ampm = hr >= 12 ? "PM" : "AM"
  const h12 = hr % 12 || 12
  return `${h12}:${m} ${ampm}`
}

function daysList(days: number[]) {
  if (days.length === 7) return "Every day"
  if (JSON.stringify([...days].sort()) === JSON.stringify([1,2,3,4,5])) return "Mon – Fri"
  if (JSON.stringify([...days].sort()) === JSON.stringify([0,6])) return "Weekends"
  return days.sort((a,b) => a-b).map(d => DAYS[d]).join(", ")
}

export function StorageEntryWindowsEditor({
  storageSpaceId,
  facilityId,
  initial,
}: {
  storageSpaceId: string
  facilityId: string
  initial: StorageEntryWindow[]
}) {
  const [windows, setWindows] = useState<StorageEntryWindow[]>(initial)
  const [showForm, setShowForm] = useState(false)
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState("")

  const [label, setLabel]     = useState("")
  const [days, setDays]       = useState<Set<number>>(new Set())
  const [startTime, setStart] = useState("06:00")
  const [endTime, setEnd]     = useState("22:00")
  const [notes, setNotes]     = useState("")

  const overnight = endTime < startTime || (endTime === "00:00" && startTime !== "00:00")

  function toggleDay(d: number) {
    setDays(prev => {
      const next = new Set(prev)
      next.has(d) ? next.delete(d) : next.add(d)
      return next
    })
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setErr("")
    if (days.size === 0) { setErr("Select at least one day."); return }
    const fd = new FormData()
    fd.set("storageSpaceId", storageSpaceId)
    fd.set("facilityId", facilityId)
    fd.set("label", label)
    fd.set("days_of_week", JSON.stringify([...days]))
    fd.set("start_time", startTime)
    fd.set("end_time", endTime)
    fd.set("overnight", overnight ? "true" : "false")
    fd.set("notes", notes)
    startTransition(async () => {
      const res = await addStorageEntryWindow(fd)
      if (res?.error) { setErr(res.error); return }
      if (res?.window) {
        setWindows(prev => [...prev, res.window as StorageEntryWindow])
        setShowForm(false)
        setLabel(""); setDays(new Set()); setStart("06:00"); setEnd("22:00"); setNotes("")
      }
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteStorageEntryWindow(id)
      setWindows(prev => prev.filter(w => w.id !== id))
    })
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[10px] font-extrabold text-[#0D2240] uppercase tracking-widest">Entry Hours</h4>
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          className="text-xs font-bold text-[#E8726A] hover:underline"
        >
          {showForm ? "Cancel" : "+ Add Window"}
        </button>
      </div>

      {windows.length === 0 && !showForm && (
        <p className="text-xs text-gray-400 italic mb-2">No entry windows set.</p>
      )}

      <div className="space-y-2 mb-3">
        {windows.map(w => (
          <div key={w.id} className="flex items-start gap-3 bg-[#f7f8fb] rounded-xl px-3 py-2.5 border border-gray-100">
            <div className="flex-1 min-w-0">
              {w.label && <p className="text-xs font-bold text-[#0D2240]">{w.label}</p>}
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <span className="text-xs text-gray-600 font-medium">{daysList(w.days_of_week)}</span>
                <span className="text-gray-300 text-xs">·</span>
                <span className="text-xs font-semibold text-[#0D2240]">
                  {fmt(w.start_time)} – {fmt(w.end_time)}
                  {w.overnight && (
                    <span className="ml-1 text-[10px] text-purple-600 font-bold bg-purple-50 px-1.5 py-0.5 rounded-full border border-purple-200">
                      Overnight
                    </span>
                  )}
                </span>
              </div>
              <div className="flex gap-1 mt-1.5">
                {DAY_SHORT.map((d, i) => (
                  <span key={i} className={`w-5 h-5 rounded-full text-[9px] font-extrabold flex items-center justify-center ${
                    w.days_of_week.includes(i)
                      ? "bg-[#0D2240] text-white"
                      : "bg-gray-100 text-gray-300"
                  }`}>{d}</span>
                ))}
              </div>
              {w.notes && <p className="text-[10px] text-gray-400 mt-1 italic">{w.notes}</p>}
            </div>
            <button
              type="button"
              onClick={() => handleDelete(w.id)}
              disabled={pending}
              className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none shrink-0 mt-0.5"
            >×</button>
          </div>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-blue-50/60 rounded-xl border border-blue-100 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Label (optional)</label>
              <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Night Access"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Use gate code #1234"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Days Available</label>
            <div className="flex gap-1.5 flex-wrap">
              {DAYS.map((d, i) => (
                <button
                  key={i} type="button" onClick={() => toggleDay(i)}
                  className={`w-10 h-10 rounded-xl text-xs font-extrabold border-2 transition-all ${
                    days.has(i)
                      ? "bg-[#0D2240] text-white border-[#0D2240]"
                      : "bg-white text-gray-400 border-gray-200 hover:border-[#0D2240]/40"
                  }`}
                >{d}</button>
              ))}
              <button type="button" onClick={() => setDays(new Set([1,2,3,4,5]))}
                className="px-3 h-10 rounded-xl text-xs font-bold border-2 border-gray-200 text-gray-400 hover:border-[#0D2240]/40 transition-all">
                M–F
              </button>
              <button type="button" onClick={() => setDays(new Set([0,1,2,3,4,5,6]))}
                className="px-3 h-10 rounded-xl text-xs font-bold border-2 border-gray-200 text-gray-400 hover:border-[#0D2240]/40 transition-all">
                Every day
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Entry Opens</label>
              <input type="time" value={startTime} onChange={e => setStart(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Entry Closes
                {overnight && <span className="ml-1.5 text-[10px] text-purple-600 font-bold">(next day)</span>}
              </label>
              <input type="time" value={endTime} onChange={e => setEnd(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
            </div>
          </div>

          {err && <p className="text-xs text-red-500 font-medium">{err}</p>}

          <div className="flex justify-end">
            <button type="submit" disabled={pending}
              className="bg-[#0D2240] hover:bg-[#1a3a5c] disabled:opacity-60 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors">
              {pending ? "Saving…" : "Save Window"}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
