import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId, getLocationTimezone } from "@/lib/location"
import { getTimezoneLabel } from "@/lib/timezone-label"
import { requireAdmin } from "@/lib/auth-guard"
import Link from "next/link"
import { OrderRow } from "@/components/admin/order-row"

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

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  await requireAdmin()
  const { status = "all", q } = await searchParams
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const timezoneLabel = getTimezoneLabel(await getLocationTimezone(locationId))

  let query = supabase
    .from("bookings")
    .select(`
      id, short_code, created_at, customer_name, customer_email, customer_phone,
      customer_address, delivery_address,
      pickup_date, pickup_time_window, delivery_date, delivery_time_window,
      status, service_type, customer_final_cents, total_amount, num_comforters, comforter_size,
      comforter_sizes, num_bags, detergent, extras, promo_code, promo_discount_cents,
      subscription_frequency, commercial_account_id,
      assigned_driver:workers!assigned_driver_id(name),
      assigned_delivery_driver:workers!assigned_delivery_driver_id(name),
      assigned_operator:workers!assigned_operator_id(name)
    `)
    .eq("location_id", locationId)
    .order("created_at", { ascending: false })
    .limit(200)

  // "All" previously meant every order ever, including cancelled ones — so
  // a cancelled order sat in the default view forever, mixed in with active
  // work. Cancelled orders are still fully visible, just one tab-click away
  // (the Cancelled tab) instead of cluttering the default list.
  if (status === "all") query = query.neq("status", "cancelled")
  else query = query.eq("status", status)
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
  const counts: Record<string, number> = {}
  allStatuses.forEach(({ status: s }) => { counts[s] = (counts[s] ?? 0) + 1 })
  // Matches the query above — "All" excludes cancelled, so the tab count
  // doesn't disagree with what's actually listed under it.
  counts.all = allStatuses.filter(({ status: s }) => s !== "cancelled").length

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0D2240]">Orders</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {counts.all ?? 0} total orders
            <span className="ml-2 text-[9px] font-bold text-gray-400 bg-[#f7f8fb] border border-gray-200 rounded-full px-2 py-0.5 uppercase tracking-wide align-middle">
              Times in {timezoneLabel}
            </span>
          </p>
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
                <OrderRow key={b.id} order={b as never} />
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
