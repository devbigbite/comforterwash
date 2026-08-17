"use client"

import { useState } from "react"
import { updateLeadStatus, type CommercialLead } from "@/app/actions/leads"

const STATUS_OPTIONS: CommercialLead["status"][] = ["new", "contacted", "responded", "won", "not_interested"]

const STATUS_BADGE: Record<string, string> = {
  new:            "bg-gray-100 text-gray-600 border border-gray-200",
  contacted:      "bg-blue-50 text-blue-700 border border-blue-200",
  responded:      "bg-amber-50 text-amber-700 border border-amber-200",
  won:            "bg-green-50 text-green-700 border border-green-200",
  not_interested: "bg-red-50 text-red-500 border border-red-200",
}

function toCsv(leads: CommercialLead[]): string {
  const headers = ["Category", "Business", "Contact", "Email", "Phone", "Website", "Service Area", "Status", "Source URL"]
  const rows = leads.map(l => [
    l.category, l.business_name, l.contact_name, l.email, l.phone, l.website, l.service_area, l.status, l.source_url,
  ])
  const escape = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`
  return [headers.map(escape).join(","), ...rows.map(r => r.map(escape).join(","))].join("\n")
}

export function LeadsTable({ initialLeads }: { initialLeads: CommercialLead[] }) {
  const [leads, setLeads] = useState(initialLeads)
  const [filter, setFilter] = useState<string>("all")

  async function handleStatusChange(leadId: string, status: CommercialLead["status"]) {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status } : l))
    await updateLeadStatus(leadId, status)
  }

  function handleExport() {
    const csv = toCsv(visibleLeads)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const categories = Array.from(new Set(leads.map(l => l.category).filter(Boolean))) as string[]
  const visibleLeads = filter === "all" ? leads : leads.filter(l => l.category === filter)

  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
        <p className="text-4xl mb-3">🔍</p>
        <p className="text-[#0D2240] font-bold">No leads yet</p>
        <p className="text-gray-400 text-sm mt-1">Run a search above to start pulling in prospects.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilter("all")}
            className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${filter === "all" ? "bg-[#0D2240] text-white" : "bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100"}`}
          >
            All
          </button>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${filter === c ? "bg-[#0D2240] text-white" : "bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100"}`}
            >
              {c}
            </button>
          ))}
        </div>
        <button
          onClick={handleExport}
          className="text-xs font-bold text-[#0D2240] bg-white border border-gray-200 hover:bg-gray-50 rounded-full px-3 py-1.5 transition-colors"
        >
          ⬇ Export CSV
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
                <th className="px-4 py-3 font-bold">Business</th>
                <th className="px-4 py-3 font-bold">Contact</th>
                <th className="px-4 py-3 font-bold">Email / Phone</th>
                <th className="px-4 py-3 font-bold">Website</th>
                <th className="px-4 py-3 font-bold">Category</th>
                <th className="px-4 py-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleLeads.map(l => (
                <tr key={l.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 font-semibold text-[#0D2240] max-w-[200px] truncate">{l.business_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{l.contact_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {l.email && <div className="truncate max-w-[200px]">{l.email}</div>}
                    {l.phone && <div className="text-gray-400">{l.phone}</div>}
                    {!l.email && !l.phone && "—"}
                  </td>
                  <td className="px-4 py-3">
                    {l.website ? (
                      <a href={l.website.startsWith("http") ? l.website : `https://${l.website}`} target="_blank" rel="noreferrer" className="text-[#E8726A] hover:underline truncate max-w-[160px] block">
                        {l.website.replace(/^https?:\/\//, "")}
                      </a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{l.category || "—"}</td>
                  <td className="px-4 py-3">
                    <select
                      value={l.status}
                      onChange={e => handleStatusChange(l.id, e.target.value as CommercialLead["status"])}
                      className={`text-xs font-bold rounded-full px-2.5 py-1 outline-none cursor-pointer ${STATUS_BADGE[l.status]}`}
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s.replace("_", " ")}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
