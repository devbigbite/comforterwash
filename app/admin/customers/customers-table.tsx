"use client"

import { useState, useTransition } from "react"
import { computeSegment, SEGMENT_LABELS, SEGMENT_COLORS, type Segment } from "@/lib/customer-segments"
import { getReferralCodeByEmail, toggleCustomerSmsOptOut } from "@/app/actions/customers"

interface Customer {
  id: string
  email: string | null
  phone: string | null
  name: string | null
  last_booking_at: string | null
  total_bookings: number
  total_spent_cents: number
  referral_code: string | null
  sms_opt_out: boolean
  segment: Segment
}

const INACTIVITY_WINDOWS = [
  { label: "Any", days: 0 },
  { label: "No booking in 30+ days", days: 30 },
  { label: "No booking in 3+ months", days: 90 },
  { label: "No booking in 6+ months", days: 180 },
  { label: "No booking in 1+ year", days: 365 },
] as const

function daysSinceLastBooking(lastBookingAt: string | null): number {
  if (!lastBookingAt) return Infinity
  return Math.floor((Date.now() - new Date(lastBookingAt).getTime()) / 86_400_000)
}

function toCsv(rows: Customer[]): string {
  const header = ["Name", "Email", "Phone", "Segment", "Last Booking", "Days Inactive", "Total Bookings", "Total Spent"]
  const lines = rows.map(c => {
    const days = daysSinceLastBooking(c.last_booking_at)
    return [
      c.name ?? "",
      c.email ?? "",
      c.phone ?? "",
      c.segment,
      c.last_booking_at ? new Date(c.last_booking_at).toLocaleDateString() : "Never",
      Number.isFinite(days) ? String(days) : "",
      String(c.total_bookings),
      (c.total_spent_cents / 100).toFixed(2),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
  })
  return [header.join(","), ...lines].join("\n")
}

export function CustomersTable({ customers }: { customers: Customer[] }) {
  const [filter, setFilter] = useState<Segment | "all">("all")
  const [inactiveDays, setInactiveDays] = useState(0)
  const [search, setSearch] = useState("")
  const [codes, setCodes] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  const filtered = customers.filter(c => {
    if (filter !== "all" && c.segment !== filter) return false
    if (inactiveDays > 0 && daysSinceLastBooking(c.last_booking_at) < inactiveDays) return false
    if (search && !(c.name ?? "").toLowerCase().includes(search.toLowerCase()) && !(c.email ?? "").toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function exportCsv() {
    const csv = toCsv(filtered)
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const label = inactiveDays > 0 ? `dormant-${inactiveDays}d` : (filter !== "all" ? filter : "all-customers")
    a.href = url
    a.download = `customers-${label}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function loadCode(c: Customer) {
    if (!c.email || codes[c.id]) return
    startTransition(async () => {
      const code = await getReferralCodeByEmail(c.email as string)
      if (code) setCodes(prev => ({ ...prev, [c.id]: code }))
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm flex-1 min-w-[180px] focus:outline-none focus:border-[#E8726A]"
        />
        <select value={filter} onChange={e => setFilter(e.target.value as Segment | "all")} className="border border-gray-200 rounded-xl px-3 py-2 text-sm">
          <option value="all">All segments</option>
          {(Object.keys(SEGMENT_LABELS) as Segment[]).map(s => (
            <option key={s} value={s}>{SEGMENT_LABELS[s]}</option>
          ))}
        </select>
        <select value={inactiveDays} onChange={e => setInactiveDays(parseInt(e.target.value, 10))} className="border border-gray-200 rounded-xl px-3 py-2 text-sm">
          {INACTIVITY_WINDOWS.map(w => (
            <option key={w.days} value={w.days}>{w.label}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400 font-semibold">{filtered.length} customer{filtered.length === 1 ? "" : "s"}</span>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="ml-auto bg-[#0D2240] hover:bg-[#142d52] text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors shadow-sm disabled:opacity-40"
        >
          ⬇ Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide border-b border-gray-100">
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Segment</th>
              <th className="px-4 py-3">Bookings</th>
              <th className="px-4 py-3">Spent</th>
              <th className="px-4 py-3">Last Booking</th>
              <th className="px-4 py-3">Days Inactive</th>
              <th className="px-4 py-3">Referral Code</th>
              <th className="px-4 py-3">SMS</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-semibold text-[#0D2240]">{c.name ?? "—"}</p>
                  <p className="text-xs text-gray-400">{c.email}{c.phone ? ` · ${c.phone}` : ""}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${SEGMENT_COLORS[c.segment]}`}>
                    {SEGMENT_LABELS[c.segment]}
                  </span>
                </td>
                <td className="px-4 py-3">{c.total_bookings}</td>
                <td className="px-4 py-3">${(c.total_spent_cents / 100).toFixed(2)}</td>
                <td className="px-4 py-3 text-gray-500">{c.last_booking_at ? new Date(c.last_booking_at).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3 text-gray-500">{Number.isFinite(daysSinceLastBooking(c.last_booking_at)) ? daysSinceLastBooking(c.last_booking_at) : "—"}</td>
                <td className="px-4 py-3">
                  {c.referral_code || codes[c.id] ? (
                    <code className="text-xs bg-[#f7f8fb] px-2 py-1 rounded-lg font-bold text-[#0D2240]">{c.referral_code ?? codes[c.id]}</code>
                  ) : (
                    <button onClick={() => loadCode(c)} disabled={isPending} className="text-xs font-semibold text-[#E8726A] hover:underline">
                      Generate
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => startTransition(() => toggleCustomerSmsOptOut(c.id, !c.sms_opt_out))}
                    className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${c.sms_opt_out ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}
                  >
                    {c.sms_opt_out ? "Opted Out" : "Opted In"}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">No customers match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
