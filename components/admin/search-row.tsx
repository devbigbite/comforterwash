"use client"

import { useState } from "react"
import Link from "next/link"
import { OrderSnapshot, type OrderSnapshotData } from "@/components/admin/order-snapshot"

const SERVICE_LABEL: Record<string, string> = {
  comforter_wash: "🛏️ Comforter",
  wash_fold:      "👕 W&F",
  wash_only:      "🧺 Wash Only",
}

const STATUS_BADGE: Record<string, string> = {
  confirmed:   "bg-blue-100 text-blue-700",
  picked_up:   "bg-amber-100 text-amber-700",
  in_progress: "bg-purple-100 text-purple-700",
  ready:       "bg-cyan-100 text-cyan-700",
  delivered:   "bg-green-100 text-green-700",
  cancelled:   "bg-red-100 text-red-700",
}

// Same click-to-expand pattern as components/admin/order-row.tsx (Orders
// list) — lets a search result be pulled up as a full snapshot inline
// without navigating to the order detail page for each hit.
export function SearchRow({
  order,
  CustomerTypeBadge,
}: {
  order: OrderSnapshotData & { created_at: string }
  CustomerTypeBadge: (props: { frequency: string | null; isCommercial: boolean }) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const b = order

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setOpen(o => !o)}>
        <td className="px-4 py-3 font-mono text-xs font-bold text-[#0D2240]">
          <span className="text-gray-300 mr-1 inline-block transition-transform" style={{ transform: open ? "rotate(90deg)" : "none" }}>▸</span>
          {b.short_code?.toUpperCase() ?? b.id.slice(0, 8).toUpperCase()}
        </td>
        <td className="px-4 py-3">
          <p className="font-semibold text-[#0D2240]">{b.customer_name}</p>
          <p className="text-xs text-gray-400">{b.customer_phone}</p>
          <div className="mt-1">
            <CustomerTypeBadge frequency={b.subscription_frequency ?? null} isCommercial={!!b.commercial_account_id} />
          </div>
        </td>
        <td className="px-4 py-3 text-xs">
          <span>{SERVICE_LABEL[b.service_type] ?? b.service_type}</span>
          {b.comforter_size && <span className="ml-1 text-gray-400 capitalize">({b.comforter_size})</span>}
        </td>
        <td className="px-4 py-3 text-xs text-gray-500">{b.pickup_date}</td>
        <td className="px-4 py-3 font-semibold text-[#0D2240]">
          ${((b.customer_final_cents ?? 0) / 100).toFixed(2)}
        </td>
        <td className="px-4 py-3">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_BADGE[b.status] ?? "bg-gray-100 text-gray-500"}`}>
            {b.status}
          </span>
        </td>
        <td className="px-4 py-3">
          <Link href={`/admin/orders/${b.id}`} onClick={e => e.stopPropagation()}
            className="text-[#E8726A] text-xs font-bold hover:underline">
            View →
          </Link>
        </td>
      </tr>
      {open && (
        <tr className="bg-[#f7f8fb] border-t border-b border-gray-100">
          <td colSpan={7} className="p-0">
            <OrderSnapshot order={b} compact />
          </td>
        </tr>
      )}
    </>
  )
}
