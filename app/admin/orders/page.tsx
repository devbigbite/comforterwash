import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"
import Link from "next/link"

export const dynamic = "force-dynamic"

const STATUS_TABS = [
  { key: "all",         label: "All" },
  { key: "confirmed",   label: "Confirmed" },
  { key: "picked_up",   label: "Picked Up" },
  { key: "in_progress", label: "In Progress" },
  { key: "ready",       label: "Ready" },
  { key: "delivered",   label: "Delivered" },
  { key: "cancelled",   label: "Cancelled" },
]

const STATUS_BADGE: Record<string, string> = {
  confirmed:   "bg-blue-100 text-blue-700",
  picked_up:   "bg-amber-100 text-amber-700",
  in_progress: "bg-purple-100 text-purple-700",
  ready:       "bg-cyan-100 text-cyan-700",
  delivered:   "bg-green-100 text-green-700",
  cancelled:   "bg-red-100 text-red-700",
}

const SERVICE_LABEL: Record<string, string> = {
  comforter_wash: "🛏️ Comforter",
  wash_fold:      "👕 W&F",
  wash_only:      "🧺 Wash Only",
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  await requireAdmin()
  const { status = "all", q } = await searchParams
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]

  let query = supabase
    .from("bookings")
    .select("id, short_code, created_at, customer_name, customer_email, customer_phone, pickup_date, delivery_date, status, service_type, customer_final_cents, num_comforters, comforter_size, num_bags")
    .eq("location_id", locationId)
    .order("created_at", { ascending: false })
    .limit(200)

  if (status !== "all") query = query.eq("status", status)
  if (q) query = query.or(`short_code.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`)

  const { data: ordersData, error: ordersError } = await query
  if (ordersError) console.error("[admin/orders] Failed to load orders:", ordersError.message)
  const orders = ordersData ?? []

  // Count per status for tab badges
  const { data: allStatusesData, error: statusesError } = await supabase
    .from("bookings")
    .select("status")
    .eq("location_id", locationId)
  if (statusesError) console.error("[admin/orders] Failed to load status counts:", statusesError.message)
  const allStatuses = allStatusesData ?? []
  const counts: Record<string, number> = { all: allStatuses.length }
  allStatuses.forEach(({ status: s }) => { counts[s] = (counts[s] ?? 0) + 1 })

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0D2240]">Orders</h1>
          <p className="text-sm text-gray-400 mt-0.5">{counts.all ?? 0} total orders</p>
        </div>
        {/* Quick search */}
        <form method="GET" className="flex gap-2">
          <input
            name="status"
            type="hidden"
            value={status}
          />
          <input
            name="q"
            defaultValue={q}
            placeholder="Name, phone, or order ID…"
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-64 focus:outline-none focus:border-[#0D2240]"
          />
          <button
            type="submit"
            className="bg-[#0D2240] text-white text-xs font-bold px-4 py-2 rounded-xl uppercase tracking-wide hover:bg-[#1a3a5c] transition-colors"
          >
            Search
          </button>
          {q && (
            <Link
              href={`/admin/orders?status=${status}`}
              className="bg-gray-100 text-gray-500 text-xs font-bold px-4 py-2 rounded-xl uppercase tracking-wide hover:bg-gray-200 transition-colors"
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {STATUS_TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/orders?status=${t.key}${q ? `&q=${q}` : ""}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all whitespace-nowrap ${
              status === t.key
                ? "bg-white text-[#0D2240] shadow-sm"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {t.label}
            {counts[t.key] !== undefined && (
              <span className="ml-1 opacity-60">({counts[t.key] ?? 0})</span>
            )}
          </Link>
        ))}
      </div>

      {/* Table */}
      {orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No orders found.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Order ID", "Customer", "Phone", "Service", "Bags", "Pickup", "Delivery", "Amount", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-[#0D2240] whitespace-nowrap">
                    {b.short_code?.toUpperCase() ?? b.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#0D2240] whitespace-nowrap">
                    {b.customer_name}
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
                      className="text-[#E8726A] text-xs font-bold hover:underline opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 200 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 text-center">
              Showing first 200 results — use search to narrow down
            </div>
          )}
        </div>
      )}
    </div>
  )
}
