"use client"

import { useRouter, usePathname } from "next/navigation"

function toISO(d: Date) {
  return d.toISOString().split("T")[0]
}

export function DateFilter({ from, to }: { from: string; to: string }) {
  const router   = useRouter()
  const pathname = usePathname()

  function apply(f: string, t: string) {
    router.push(`${pathname}?from=${f}&to=${t}`)
  }

  function preset(days: number) {
    const end   = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    apply(toISO(days === 0 ? end : start), toISO(end))
  }

  function thisMonth() {
    const n = new Date()
    apply(toISO(new Date(n.getFullYear(), n.getMonth(), 1)), toISO(n))
  }
  function lastMonth() {
    const n = new Date()
    apply(
      toISO(new Date(n.getFullYear(), n.getMonth() - 1, 1)),
      toISO(new Date(n.getFullYear(), n.getMonth(), 0)),
    )
  }
  function thisYear() {
    const n = new Date()
    apply(toISO(new Date(n.getFullYear(), 0, 1)), toISO(n))
  }
  function allTime() {
    apply("2024-01-01", toISO(new Date()))
  }

  const btn = "px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-[#0D2240] hover:text-white transition-colors"

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider shrink-0">Range:</span>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => preset(0)}  className={btn}>Today</button>
          <button onClick={() => preset(7)}  className={btn}>Last 7d</button>
          <button onClick={() => preset(30)} className={btn}>Last 30d</button>
          <button onClick={() => preset(90)} className={btn}>Last 90d</button>
          <button onClick={thisMonth}        className={btn}>This Month</button>
          <button onClick={lastMonth}        className={btn}>Last Month</button>
          <button onClick={thisYear}         className={btn}>This Year</button>
          <button onClick={allTime}          className={btn}>All Time</button>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <input
            type="date"
            defaultValue={from}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#0D2240]/20"
            onChange={e => e.target.value && apply(e.target.value, to)}
          />
          <span className="text-xs text-gray-400">→</span>
          <input
            type="date"
            defaultValue={to}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#0D2240]/20"
            onChange={e => e.target.value && apply(from, e.target.value)}
          />
        </div>
      </div>
      <p className="text-[10px] text-gray-400 mt-2">
        Showing: <span className="font-semibold text-gray-500">{from}</span> → <span className="font-semibold text-gray-500">{to}</span>
      </p>
    </div>
  )
}
