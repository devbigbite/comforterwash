"use client"

import { useRouter } from "next/navigation"

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, "0")
  const dd = String(dt.getDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

export function DispatchDateNav({
  selectedDate,
  today,
}: {
  selectedDate: string
  today: string
}) {
  const router = useRouter()

  const navigate = (date: string) => {
    router.push(`/admin/dispatch?date=${date}`)
  }

  return (
    <div className="flex items-center gap-1.5">
      {/* Prev day */}
      <button
        onClick={() => navigate(addDays(selectedDate, -1))}
        className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:text-[#0D2240] hover:border-gray-300 transition-colors"
        aria-label="Previous day"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      {/* Date input — navigates immediately on change */}
      <input
        type="date"
        value={selectedDate}
        onChange={e => { if (e.target.value) navigate(e.target.value) }}
        className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
      />

      {/* Next day */}
      <button
        onClick={() => navigate(addDays(selectedDate, 1))}
        className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:text-[#0D2240] hover:border-gray-300 transition-colors"
        aria-label="Next day"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      {/* Today shortcut — only shown when not on today */}
      {selectedDate !== today && (
        <button
          onClick={() => navigate(today)}
          className="ml-1 rounded-xl border border-gray-200 text-gray-500 hover:text-[#0D2240] font-semibold text-sm px-4 py-2 transition-colors"
        >
          Today
        </button>
      )}
    </div>
  )
}
