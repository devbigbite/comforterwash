"use client"

import { useState, useTransition } from "react"
import { format } from "date-fns"
import { bulkAssignFacility } from "@/app/actions/facility-routing"

type Order = {
  id: string
  short_code: string
  customer_name: string
  service_type: string
  pickup_date: string | null
  status: string
  actual_weight_lbs: number | null
  num_bags: number | null
  assigned_facility_id: string | null
  facility_name: string | null
}

type Facility = {
  id: string
  name: string
  processing_mode: string | null
  rate_per_lb: number | null
  minimum_lbs: number | null
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  confirmed:   { label: "Confirmed",   color: "bg-blue-50 text-blue-700 border-blue-200" },
  picked_up:   { label: "Picked Up",   color: "bg-amber-50 text-amber-700 border-amber-200" },
  at_warehouse:{ label: "At Warehouse",color: "bg-purple-50 text-purple-700 border-purple-200" },
  at_facility: { label: "At Facility", color: "bg-green-50 text-green-700 border-green-200" },
}

const SERVICE_LABEL: Record<string, string> = {
  comforter_wash: "Comforter",
  wash_fold:      "Wash & Fold",
  wash_only:      "Wash Only",
}

type Tab = "unassigned" | "at_warehouse" | "all"

export function RoutingClient({ orders, facilities }: { orders: Order[]; facilities: Facility[] }) {
  const [tab, setTab] = useState<Tab>("at_warehouse")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [facilityId, setFacilityId] = useState("")
  const [result, setResult] = useState<{ success: boolean; count?: number; error?: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = orders.filter(o => {
    if (tab === "unassigned")   return !o.assigned_facility_id
    if (tab === "at_warehouse") return o.status === "at_warehouse"
    return true
  })

  const allSelected = filtered.length > 0 && filtered.every(o => selected.has(o.id))

  function toggleAll() {
    if (allSelected) {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(o => s.delete(o.id)); return s })
    } else {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(o => s.add(o.id)); return s })
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  function handleAssign() {
    if (!facilityId || selected.size === 0) return
    setResult(null)
    startTransition(async () => {
      const r = await bulkAssignFacility(Array.from(selected), facilityId)
      setResult(r)
      if (r.success) {
        setSelected(new Set())
        setFacilityId("")
      }
    })
  }

  const counts = {
    all:          orders.length,
    unassigned:   orders.filter(o => !o.assigned_facility_id).length,
    at_warehouse: orders.filter(o => o.status === "at_warehouse").length,
  }

  return (
    <div className="space-y-5">

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([
          { key: "at_warehouse" as Tab, label: "At Warehouse", count: counts.at_warehouse },
          { key: "unassigned"   as Tab, label: "Unassigned",   count: counts.unassigned },
          { key: "all"          as Tab, label: "All Active",   count: counts.all },
        ]).map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSelected(new Set()) }}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              tab === t.key ? "bg-white text-[#0D2240] shadow-sm" : "text-gray-400 hover:text-[#0D2240]"
            }`}>
            {t.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-bold ${
              tab === t.key ? "bg-[#E8726A]/10 text-[#E8726A]" : "bg-gray-200 text-gray-400"
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Bulk assign toolbar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-bold text-[#0D2240]">
          {selected.size === 0 ? "Select orders to assign" : `${selected.size} order${selected.size !== 1 ? "s" : ""} selected`}
        </span>
        <select
          value={facilityId}
          onChange={e => setFacilityId(e.target.value)}
          disabled={selected.size === 0}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 bg-white disabled:opacity-40 min-w-[220px]">
          <option value="">— select facility —</option>
          {facilities.map(f => (
            <option key={f.id} value={f.id}>
              {f.name}
              {f.processing_mode === "partner_attendant" ? " · Partner" : " · Own Op"}
              {f.rate_per_lb ? ` · $${f.rate_per_lb}/lb` : ""}
            </option>
          ))}
        </select>
        <button
          onClick={handleAssign}
          disabled={selected.size === 0 || !facilityId || isPending}
          className="rounded-xl bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 text-white font-bold text-sm px-5 py-2 transition-colors">
          {isPending ? "Assigning…" : "Assign to Facility"}
        </button>
        {result && (
          <span className={`text-sm font-semibold ${result.success ? "text-green-600" : "text-red-500"}`}>
            {result.success ? `✓ ${result.count} order${(result.count ?? 0) !== 1 ? "s" : ""} assigned` : `Error: ${result.error}`}
          </span>
        )}
      </div>

      {/* Orders table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">No orders in this view</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className="rounded border-gray-300 text-[#E8726A] focus:ring-[#E8726A]/30 cursor-pointer" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Order</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Service</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Pickup</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Bags / lbs</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Facility</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(order => {
                const isSel = selected.has(order.id)
                const badge = STATUS_BADGE[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-500 border-gray-200" }
                return (
                  <tr key={order.id}
                    onClick={() => toggleOne(order.id)}
                    className={`cursor-pointer transition-colors ${isSel ? "bg-[#fdf6f5]" : "hover:bg-gray-50"}`}>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={isSel} onChange={() => toggleOne(order.id)}
                        className="rounded border-gray-300 text-[#E8726A] focus:ring-[#E8726A]/30 cursor-pointer" />
                    </td>
                    <td className="px-4 py-3">
                      <a href={`/admin/orders/${order.id}`} onClick={e => e.stopPropagation()}
                        className="font-bold text-[#0D2240] font-mono hover:text-[#E8726A] transition-colors">
                        #{order.short_code}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-[#0D2240] font-medium">{order.customer_name}</td>
                    <td className="px-4 py-3 text-gray-500">{SERVICE_LABEL[order.service_type] ?? order.service_type}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {order.pickup_date ? format(new Date(order.pickup_date), "EEE, MMM d") : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {order.num_bags ?? "—"} bags
                      {order.actual_weight_lbs ? <span className="text-gray-400 ml-1">· {order.actual_weight_lbs} lbs</span> : ""}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {order.facility_name
                        ? <span className="text-[#0D2240] font-medium text-xs">{order.facility_name}</span>
                        : <span className="text-gray-300 text-xs italic">Unassigned</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <a href={`/admin/orders/${order.id}`} onClick={e => e.stopPropagation()}
                        className="text-xs text-gray-400 hover:text-[#0D2240] transition-colors">
                        View →
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
