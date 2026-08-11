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

// Inlined here (rather than passed down as a prop from the server component)
// because Next.js can't serialize a function across the server/client
// boundary — passing CustomerTypeBadge as a prop from a Server Component
// into this "use client" component threw "Functions cannot be passed
// directly to Client Components" and 500'd the whole Orders page.
function CustomerTypeBadge({ frequency, isCommercial }: { frequency: string | null; isCommercial: boolean }) {
  if (isCommercial) {
    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 uppercase whitespace-nowrap">🏢 Commercial</span>
  }
  if (frequency === "weekly" || frequency === "biweekly") {
    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 uppercase whitespace-nowrap">🔁 {frequency}</span>
  }
  return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase whitespace-nowrap">One-time</span>
}

// Click-to-expand row — lets a dispatcher scan the list and pull up an
// order's full snapshot (pickup/delivery timing, what's inside, who it's
// for/assigned to, cost) inline, without leaving the Orders list to open
// each order's full detail page one at a time.
export function OrderRow({
  order,
}: {
  order: OrderSnapshotData & { created_at: string }
}) {
  const [open, setOpen] = useState(false)
  const b = order
  const orderCode = b.short_code?.toUpperCase() ?? b.id.slice(0, 8).toUpperCase()

  return (
    <>
      <tr
        className="hover:bg-gray-50 transition-colors group cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <td className="px-4 py-3 font-mono text-xs font-bold text-[#0D2240] whitespace-nowrap">
          <span className="text-gray-300 mr-1 inline-block transition-transform" style={{ transform: open ? "rotate(90deg)" : "none" }}>▸</span>
          {orderCode}
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <p className="font-semibold text-[#0D2240]">{b.customer_name}</p>
          <div className="mt-0.5">
            <CustomerTypeBadge frequency={b.subscription_frequency ?? null} isCommercial={!!b.commercial_account_id} />
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
          {b.customer_phone}
        </td>
        <td className="px-4 py-3 text-xs whitespace-nowrap">
          {SERVICE_LABEL[b.service_type] ?? b.service_type}
          {b.comforter_size && (
            <span className="ml-1 text-gray-400 capitalize">({b.comforter_size})</span>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-gray-500 text-center">
          {b.num_bags ?? b.num_comforters ?? "—"}
        </td>
        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
          {b.pickup_date ?? "—"}
        </td>
        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
          {b.delivery_date ?? "—"}
        </td>
        <td className="px-4 py-3 font-semibold text-[#0D2240] whitespace-nowrap">
          ${((b.customer_final_cents ?? 0) / 100).toFixed(2)}
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_BADGE[b.status] ?? "bg-gray-100 text-gray-500"}`}>
            {b.status?.replace(/_/g, " ")}
          </span>
        </td>
        <td className="px-4 py-3">
          <Link
            href={`/admin/orders/${b.id}`}
            onClick={e => e.stopPropagation()}
            className="text-[#E8726A] text-xs font-bold hover:underline opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
          >
            Open →
          </Link>
        </td>
      </tr>
      {open && (
        <tr className="bg-[#f7f8fb] border-t border-b border-gray-100">
          <td colSpan={9} className="p-0">
            <OrderSnapshot order={b} compact />
          </td>
        </tr>
      )}
    </>
  )
}
