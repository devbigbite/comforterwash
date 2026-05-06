"use client"

import { useState, useTransition } from "react"
import { closeTipPool, reopenTipPool } from "@/app/actions/tip-pools"
import type { WeekSummary, ApprovedWorker, TipPool } from "@/app/actions/tip-pools"

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function fmtDate(dateStr: string) {
  // "YYYY-MM-DD" → "Mon DD"
  const d = new Date(dateStr + "T12:00:00Z")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

// ── Current week card ────────────────────────────────────────────────────────

function CurrentWeekCard({
  weekSummary,
  workers,
  alreadyClosed,
}: {
  weekSummary: WeekSummary
  workers: ApprovedWorker[]
  alreadyClosed: boolean
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(workers.map(w => w.id))
  )
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const toggleWorker = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedCount = selected.size
  const perWorker = selectedCount > 0 ? Math.floor(weekSummary.totalCents / selectedCount) : 0

  const handleClose = () => {
    setError(null)
    const ids = workers.filter(w => selected.has(w.id)).map(w => w.id)
    const names = workers.filter(w => selected.has(w.id)).map(w => w.name)
    startTransition(async () => {
      const result = await closeTipPool(
        weekSummary.weekStart,
        weekSummary.weekEnd,
        weekSummary.totalCents,
        ids,
        names,
        notes,
      )
      if (result.error) setError(result.error)
    })
  }

  if (alreadyClosed) {
    return (
      <div className="rounded-2xl bg-green-50 border border-green-200 p-5">
        <div className="flex items-center gap-2 text-green-700 font-bold text-sm mb-1">
          <span>✓</span> This week&apos;s pool has been closed &amp; recorded.
        </div>
        <p className="text-xs text-green-600">Check the history below for details.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
      {/* Week header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">Current Week</p>
          <p className="font-bold text-[#0D2240]">
            {fmtDate(weekSummary.weekStart)} – {fmtDate(weekSummary.weekEnd)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-extrabold text-[#E8726A]">{fmt(weekSummary.totalCents)}</p>
          <p className="text-xs text-gray-400">{weekSummary.orderCount} tip{weekSummary.orderCount !== 1 ? "s" : ""} collected</p>
        </div>
      </div>

      {weekSummary.totalCents === 0 && (
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-sm text-gray-400 text-center">
          No tips collected this week yet.
        </div>
      )}

      {/* Worker selector */}
      {workers.length === 0 ? (
        <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-700">
          No approved workers found. <a href="/admin/workers" className="underline font-medium">Manage workers →</a>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-bold text-[#0D2240]">Select workers who worked this week</p>
          <div className="grid gap-2">
            {workers.map(w => {
              const isOn = selected.has(w.id)
              return (
                <label key={w.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${isOn ? "border-[#0D2240] bg-[#f5f7fa]" : "border-gray-100 bg-white hover:border-gray-200"}`}>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isOn ? "border-[#0D2240] bg-[#0D2240]" : "border-gray-300"}`}>
                    {isOn && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <input type="checkbox" className="sr-only" checked={isOn} onChange={() => toggleWorker(w.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#0D2240] text-sm">{w.name}</p>
                    <p className="text-xs text-gray-400">{w.roles?.join(", ") ?? "—"}</p>
                  </div>
                  {isOn && weekSummary.totalCents > 0 && (
                    <span className="text-sm font-bold text-[#E8726A] shrink-0">{fmt(perWorker)}</span>
                  )}
                </label>
              )
            })}
          </div>

          {/* Per-worker preview */}
          {selectedCount > 0 && weekSummary.totalCents > 0 && (
            <div className="rounded-xl bg-[#fdf6f5] p-3 flex items-center justify-between text-sm">
              <span className="text-gray-600">{selectedCount} worker{selectedCount !== 1 ? "s" : ""} selected</span>
              <span className="font-extrabold text-[#0D2240]">{fmt(perWorker)} each</span>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="text-sm font-bold text-[#0D2240] block mb-1.5">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
        <textarea
          rows={2}
          placeholder="e.g. Paid via Zelle on Monday"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A] resize-none"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handleClose}
        disabled={isPending || weekSummary.totalCents === 0 || selectedCount === 0}
        className="w-full h-11 rounded-xl bg-[#0D2240] text-white font-bold text-sm hover:bg-[#1a3a5c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
        {isPending ? "Saving…" : "Close Pool & Record Payment"}
      </button>
    </div>
  )
}

// ── History table ────────────────────────────────────────────────────────────

function HistoryRow({ pool }: { pool: TipPool }) {
  const [isPending, startTransition] = useTransition()

  const handleReopen = () => {
    startTransition(async () => {
      await reopenTipPool(pool.id)
    })
  }

  return (
    <div className={`rounded-2xl border p-5 space-y-3 ${pool.status === "paid" ? "border-green-200 bg-green-50/40" : "border-amber-200 bg-amber-50/40"}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-bold text-[#0D2240] text-sm">
            {fmtDate(pool.week_start)} – {fmtDate(pool.week_end)}
          </p>
          {pool.paid_at && (
            <p className="text-xs text-gray-400 mt-0.5">
              Closed {new Date(pool.paid_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${pool.status === "paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
            {pool.status === "paid" ? "Paid" : "Open"}
          </span>
          <span className="text-2xl font-extrabold text-[#E8726A]">{fmt(pool.total_cents)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="text-gray-600">
          {pool.worker_count} worker{pool.worker_count !== 1 ? "s" : ""}:&nbsp;
          <span className="text-[#0D2240] font-medium">{pool.worker_names.join(", ")}</span>
        </div>
        <span className="font-extrabold text-[#0D2240] shrink-0 ml-3">{fmt(pool.per_worker_cents)} each</span>
      </div>

      {pool.notes && (
        <p className="text-xs text-gray-500 italic">{pool.notes}</p>
      )}

      {pool.status === "paid" && (
        <button
          onClick={handleReopen}
          disabled={isPending}
          className="text-xs text-gray-400 hover:text-[#E8726A] transition-colors disabled:opacity-40">
          {isPending ? "Reopening…" : "Reopen pool"}
        </button>
      )}
    </div>
  )
}

// ── Main export ──────────────────────────────────────────────────────────────

export function TipPoolManager({
  weekSummary,
  workers,
  history,
}: {
  weekSummary: WeekSummary
  workers: ApprovedWorker[]
  history: TipPool[]
}) {
  const alreadyClosed = history.some(
    p => p.week_start === weekSummary.weekStart && p.status === "paid"
  )

  return (
    <div className="space-y-6">
      <CurrentWeekCard
        weekSummary={weekSummary}
        workers={workers}
        alreadyClosed={alreadyClosed}
      />

      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Pool History</h2>
          {history.map(pool => (
            <HistoryRow key={pool.id} pool={pool} />
          ))}
        </div>
      )}

      {history.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-4">No past pools yet.</p>
      )}
    </div>
  )
}
