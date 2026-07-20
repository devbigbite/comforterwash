import { getRecentWalkinOrders } from "@/app/actions/walkin"
import { WalkinForm } from "./walkin-form"
import { MarkPickedUpButton } from "./mark-picked-up-button"
import Link from "next/link"

export const dynamic = "force-dynamic"

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  picked_up: { label: "In Progress", color: "bg-blue-50 text-blue-700 border border-blue-200" },
  in_progress: { label: "Washing", color: "bg-purple-50 text-purple-700 border border-purple-200" },
  delivered: { label: "Picked Up", color: "bg-green-50 text-green-700 border border-green-200" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-500" },
}

export default async function WalkinPage() {
  const orders = await getRecentWalkinOrders()

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0D2240]">Walk-In / Drop-Off</h1>
          <p className="text-sm text-gray-400 mt-1">Quick intake for customers who bring their bags in person — no pickup/delivery driver involved.</p>
        </div>
        <Link href="/admin" className="text-sm text-gray-400 hover:text-[#0D2240] transition-colors">← Admin</Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-extrabold text-[#0D2240] text-sm uppercase tracking-wide mb-4">New Drop-Off</h2>
        <WalkinForm />
      </div>

      <div>
        <h2 className="font-extrabold text-[#0D2240] text-sm uppercase tracking-wide mb-3">Recent Walk-Ins</h2>
        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
            No walk-in orders yet.
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map(o => {
              const badge = STATUS_LABEL[o.status] ?? { label: o.status, color: "bg-gray-100 text-gray-500" }
              return (
                <div key={o.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="font-mono font-extrabold text-[#0D2240] text-sm shrink-0">
                      {o.short_code?.toUpperCase() ?? o.id.slice(0, 6).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-[#0D2240] text-sm truncate">{o.customer_name}</p>
                      <p className="text-xs text-gray-400">{o.customer_phone} · {o.num_bags} bag{o.num_bags !== 1 ? "s" : ""} · ${(o.total_amount / 100).toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${badge.color}`}>{badge.label}</span>
                    <Link href={`/admin/orders/${o.id}`} className="text-[10px] font-bold text-[#0D2240] border border-gray-200 bg-white px-2.5 py-1.5 rounded-lg hover:border-[#0D2240] transition-colors">
                      Details
                    </Link>
                    {o.status !== "delivered" && <MarkPickedUpButton bookingId={o.id} />}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
