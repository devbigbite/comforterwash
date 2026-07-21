import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"
import Link from "next/link"

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

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; name?: string; phone?: string; year?: string; month?: string }>
}) {
  await requireAdmin()
  const { q, name, phone, year, month } = await searchParams
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]

  let query = supabase
    .from("bookings")
    .select("id, short_code, created_at, customer_name, customer_email, customer_phone, customer_address, pickup_date, delivery_date, status, service_type, customer_final_cents, num_comforters, comforter_size")
    .eq("location_id", locationId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (q) query = query.ilike("short_code", `%${q}%`)
  if (name) query = query.ilike("customer_name", `%${name}%`)
  if (phone) query = query.ilike("customer_phone", `%${phone}%`)
  if (year) query = query.gte("created_at", `${year}-01-01`).lte("created_at", `${year}-12-31T23:59:59`)
  if (month && year) {
    const m = month.padStart(2, "0")
    query = query.gte("created_at", `${year}-${m}-01`).lte("created_at", `${year}-${m}-31T23:59:59`)
  }

  const hasFilter = q || name || phone || year
  const { data: resultsData, error: resultsError } = hasFilter ? await query : { data: [], error: null }
  if (resultsError) console.error("[admin/search] Failed to load results:", resultsError.message)
  const results = resultsData ?? []

  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i))
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-[#0D2240]">Order Search</h1>
        <p className="text-sm text-gray-400">Search by order ID, customer name, phone, or date range</p>
      </div>

      {/* Search bar */}
      <form method="GET" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-3">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Order ID</label>
            <input name="q" defaultValue={q} placeholder="ABC12345"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#E8726A]" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Customer Name</label>
            <input name="name" defaultValue={name} placeholder="Jane Smith"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Phone</label>
            <input name="phone" defaultValue={phone} placeholder="(407) 555-0100"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Year</label>
              <select name="year" defaultValue={year}
                className="w-full border border-gray-200 rounded-xl px-2 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]">
                <option value="">All</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Month</label>
              <select name="month" defaultValue={month}
                className="w-full border border-gray-200 rounded-xl px-2 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]">
                <option value="">All</option>
                {months.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit"
            className="bg-[#0D2240] hover:bg-[#1a3a5c] text-white font-bold px-6 py-2.5 rounded-xl text-sm uppercase tracking-wide transition-colors">
            Search
          </button>
          <Link href="/admin/search"
            className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold px-6 py-2.5 rounded-xl text-sm uppercase tracking-wide transition-colors">
            Reset
          </Link>
        </div>
      </form>

      {/* Results */}
      {!hasFilter && (
        <div className="text-center py-12 text-gray-400 text-sm">Enter a search term above to find orders.</div>
      )}

      {hasFilter && results.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">No orders found matching your search.</div>
      )}

      {results.length > 0 && (
        <>
          <p className="text-xs text-gray-400 mb-3">{results.length} result{results.length !== 1 ? "s" : ""}</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Order ID", "Customer", "Service", "Pickup", "Amount", "Status", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {results.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-[#0D2240]">
                      {b.short_code?.toUpperCase() ?? b.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#0D2240]">{b.customer_name}</p>
                      <p className="text-xs text-gray-400">{b.customer_phone}</p>
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
                      <Link href={`/admin/orders/${b.id}`}
                        className="text-[#E8726A] text-xs font-bold hover:underline">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
