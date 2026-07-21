import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"
import { DateFilter } from "./date-filter"

// ─── helpers ────────────────────────────────────────────────────────────────
function fmt$(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtN(n: number) { return n.toLocaleString("en-US") }
function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const SERVICE_LABEL: Record<string, string> = {
  comforter_wash: "Comforter Wash",
  wash_fold:      "Wash & Fold",
  wash_only:      "Wash Only",
}

// ─── data fetching ───────────────────────────────────────────────────────────
async function getReportData(from: string, to: string, locationId: string) {
  const supabase  = createAdminClient()
  const fromTs    = from + "T00:00:00"
  const toTs      = to   + "T23:59:59"

  const [
    { data: bookings   = [] },
    { data: cancelled  = [] },
    { data: allBookings = [] },
    { data: subs       = [] },
    { data: workers    = [] },
    { data: payouts    = [] },
    { data: promoCodes = [] },
  ] = await Promise.all([
    // Delivered/active in date range
    supabase
      .from("bookings")
      .select("id, created_at, customer_name, customer_email, customer_phone, service_type, status, total_amount, actual_weight_lbs, num_bags, promo_code, promo_discount_cents, pickup_date, delivery_date")
      .eq("location_id", locationId)
      .neq("status", "cancelled")
      .gte("created_at", fromTs)
      .lte("created_at", toTs)
      .order("created_at", { ascending: true }),

    // Cancelled orders in date range
    supabase
      .from("bookings")
      .select("id, created_at, customer_name, customer_email, customer_phone, service_type, total_amount, pickup_date")
      .eq("location_id", locationId)
      .eq("status", "cancelled")
      .gte("created_at", fromTs)
      .lte("created_at", toTs)
      .order("created_at", { ascending: false })
      .limit(50),

    // All-time non-cancelled for re-engage calc
    supabase
      .from("bookings")
      .select("customer_email, customer_phone, customer_name, created_at")
      .eq("location_id", locationId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false }),

    // All subscriptions
    supabase
      .from("subscriptions")
      .select("id, status, created_at, customer_name, customer_email, frequency, price_per_lb_cents, next_pickup_date")
      .eq("location_id", locationId),

    supabase
      .from("workers")
      .select("id, name, roles, status")
      .eq("location_id", locationId),

    supabase
      .from("worker_payouts")
      .select("worker_id, amount_cents, payout_type, created_at")
      .eq("location_id", locationId)
      .gte("created_at", fromTs)
      .lte("created_at", toTs),

    supabase
      .from("promo_codes")
      .select("code, description, current_uses, discount_type, discount_value")
      .eq("location_id", locationId),
  ])

  return {
    bookings:    bookings    ?? [],
    cancelled:   cancelled   ?? [],
    allBookings: allBookings ?? [],
    subs:        subs        ?? [],
    workers:     workers     ?? [],
    payouts:     payouts     ?? [],
    promoCodes:  promoCodes  ?? [],
  }
}

// ─── sub-components ──────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? "bg-[#0D2240] border-transparent text-white" : "bg-white border-gray-100 shadow-sm"}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${accent ? "text-white/50" : "text-gray-400"}`}>{label}</p>
      <p className={`text-2xl font-extrabold ${accent ? "text-white" : "text-[#0D2240]"}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${accent ? "text-white/50" : "text-gray-400"}`}>{sub}</p>}
    </div>
  )
}

function Section({ title, children, emoji }: { title: string; children: React.ReactNode; emoji?: string }) {
  return (
    <section className="mb-12">
      <div className="flex items-center gap-3 mb-5">
        {emoji && <span className="text-base">{emoji}</span>}
        <h2 className="text-base font-extrabold text-[#0D2240] uppercase tracking-wide">{title}</h2>
        <div className="flex-1 h-px bg-gray-100" />
      </div>
      {children}
    </section>
  )
}

// ─── page ────────────────────────────────────────────────────────────────────
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  await requireAdmin()
  const locationId = await getLocationId()
  const sp   = await searchParams
  const now  = new Date()
  const defaultTo   = now.toISOString().split("T")[0]
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  const from = sp.from ?? defaultFrom
  const to   = sp.to   ?? defaultTo

  const { bookings, cancelled, allBookings, subs, workers, payouts, promoCodes } =
    await getReportData(from, to, locationId)

  // ── Derived: delivered orders in range ───────────────────────────────────
  const delivered = bookings.filter(b => b.status === "delivered")

  // ── Business Performance ──────────────────────────────────────────────────
  const totalRevCents  = delivered.reduce((s, b) => s + (b.total_amount ?? 0), 0)
  const totalOrders    = delivered.length
  const totalLbs       = delivered.reduce((s, b) => s + (b.actual_weight_lbs ?? 0), 0)
  const avgOrderCents  = totalOrders ? Math.round(totalRevCents / totalOrders) : 0
  const totalBags      = bookings.reduce((s, b) => s + (b.num_bags ?? 0), 0)

  // Revenue by service
  const byService: Record<string, { orders: number; revCents: number; lbs: number }> = {}
  delivered.forEach(b => {
    const k = b.service_type ?? "unknown"
    if (!byService[k]) byService[k] = { orders: 0, revCents: 0, lbs: 0 }
    byService[k].orders++
    byService[k].revCents += b.total_amount ?? 0
    byService[k].lbs      += b.actual_weight_lbs ?? 0
  })

  // Daily recap across range (up to 60 days shown)
  const rangeMs   = new Date(to).getTime() - new Date(from).getTime()
  const rangeDays = Math.min(Math.ceil(rangeMs / 86_400_000) + 1, 60)
  const daily: Record<string, { orders: number; revCents: number; pickups: number; deliveries: number }> = {}
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split("T")[0]
    if (key >= from && key <= to) daily[key] = { orders: 0, revCents: 0, pickups: 0, deliveries: 0 }
  }
  // fill orders
  delivered.forEach(b => {
    const day = b.created_at.split("T")[0]
    if (daily[day]) { daily[day].orders++; daily[day].revCents += b.total_amount ?? 0 }
  })
  // fill driver pickups / deliveries
  bookings.forEach(b => {
    if (b.pickup_date   && daily[b.pickup_date])   daily[b.pickup_date].pickups++
    if (b.delivery_date && daily[b.delivery_date]) daily[b.delivery_date].deliveries++
  })
  const dailyEntries = Object.entries(daily).sort(([a], [b]) => b.localeCompare(a)).slice(0, 30)

  // ── Cancelled orders ──────────────────────────────────────────────────────
  const totalCancelledRev = cancelled.reduce((s, b) => s + (b.total_amount ?? 0), 0)

  // ── Driver activity ───────────────────────────────────────────────────────
  const totalPickups    = Object.values(daily).reduce((s, d) => s + d.pickups, 0)
  const totalDeliveries = Object.values(daily).reduce((s, d) => s + d.deliveries, 0)

  // ── Customers in range ────────────────────────────────────────────────────
  const custMap: Record<string, { name: string; email: string; phone: string; orders: number; revCents: number; lbs: number; lastOrder: string }> = {}
  delivered.forEach(b => {
    const k = b.customer_email ?? b.customer_phone ?? b.customer_name
    if (!custMap[k]) custMap[k] = { name: b.customer_name, email: b.customer_email ?? "", phone: b.customer_phone ?? "", orders: 0, revCents: 0, lbs: 0, lastOrder: b.created_at }
    custMap[k].orders++
    custMap[k].revCents += b.total_amount ?? 0
    custMap[k].lbs      += b.actual_weight_lbs ?? 0
    if (b.created_at > custMap[k].lastOrder) custMap[k].lastOrder = b.created_at
  })
  const customers      = Object.values(custMap).sort((a, b) => b.revCents - a.revCents)
  const totalCusts     = customers.length
  const repeatCusts    = customers.filter(c => c.orders > 1).length
  const topCustomers   = customers.slice(0, 15)

  // ── Re-engage — all-time last order date ─────────────────────────────────
  const allCustLast: Record<string, { name: string; email: string; phone: string; lastOrder: string }> = {}
  allBookings.forEach(b => {
    const k = b.customer_email ?? b.customer_phone ?? b.customer_name
    if (!allCustLast[k] || b.created_at > allCustLast[k].lastOrder) {
      allCustLast[k] = { name: b.customer_name, email: b.customer_email ?? "", phone: b.customer_phone ?? "", lastOrder: b.created_at }
    }
  })
  const today = now.toISOString().split("T")[0]
  const reEngage = Object.values(allCustLast)
    .filter(c => daysSince(c.lastOrder) >= 30)
    .sort((a, b) => daysSince(b.lastOrder) - daysSince(a.lastOrder))
  const re30  = reEngage.filter(c => daysSince(c.lastOrder) < 60).length
  const re60  = reEngage.filter(c => daysSince(c.lastOrder) >= 60 && daysSince(c.lastOrder) < 90).length
  const re90  = reEngage.filter(c => daysSince(c.lastOrder) >= 90).length

  // ── Subscriptions ─────────────────────────────────────────────────────────
  const activeSubs    = subs.filter(s => s.status === "active")
  const pausedSubs    = subs.filter(s => s.status === "paused")
  const cancelledSubs = subs.filter(s => s.status === "cancelled")

  // ── Workers & payouts ─────────────────────────────────────────────────────
  const workerPay: Record<string, number> = {}
  payouts.forEach(p => { workerPay[p.worker_id] = (workerPay[p.worker_id] ?? 0) + (p.amount_cents ?? 0) })
  const activeWorkers    = workers.filter(w => w.status === "active")
  const totalPaidCents   = Object.values(workerPay).reduce((s, v) => s + v, 0)

  // ── Promo usage ───────────────────────────────────────────────────────────
  const promoUsage: Record<string, { orders: number; savCents: number }> = {}
  delivered.forEach(b => {
    if (b.promo_code) {
      if (!promoUsage[b.promo_code]) promoUsage[b.promo_code] = { orders: 0, savCents: 0 }
      promoUsage[b.promo_code].orders++
      promoUsage[b.promo_code].savCents += b.promo_discount_cents ?? 0
    }
  })
  const totalPromoSavings = Object.values(promoUsage).reduce((s, p) => s + p.savCents, 0)

  // ─ CSV data for client export ─────────────────────────────────────────────
  const csvRows = [
    ["Name","Email","Phone","Orders","Revenue","Pounds","Last Order"],
    ...topCustomers.map(c => [
      c.name,
      c.email,
      c.phone,
      String(c.orders),
      (c.revCents / 100).toFixed(2),
      c.lbs.toFixed(1),
      c.lastOrder.split("T")[0],
    ])
  ]
  const csvContent = csvRows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n")

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0D2240]">Reports</h1>
          <p className="text-sm text-gray-400">Revenue, customers, staff, promotions</p>
        </div>
      </div>

      <DateFilter from={from} to={to} />

      {/* ── SECTION: Business Performance ─────────────────────────────── */}
      <Section title="Business Performance" emoji="📊">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Revenue (Delivered)"   value={fmt$(totalRevCents)}                    sub={`${totalOrders} delivered orders`} />
          <StatCard label="Avg Order Value"        value={fmt$(avgOrderCents)}                    />
          <StatCard label="Pounds Processed"       value={`${fmtN(Math.round(totalLbs))} lbs`}   sub="wash & fold / wash only" />
          <StatCard label="Bags Handled"           value={fmtN(totalBags)}                        sub="all active orders" />
        </div>

        {/* Revenue by service */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h3 className="font-extrabold text-[#0D2240] text-sm mb-4">Revenue by Service</h3>
          {Object.keys(byService).length === 0 ? (
            <p className="text-sm text-gray-400">No delivered orders in this period.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(byService)
                .sort((a, b) => b[1].revCents - a[1].revCents)
                .map(([type, d]) => {
                  const pct = totalRevCents > 0 ? (d.revCents / totalRevCents) * 100 : 0
                  return (
                    <div key={type}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-semibold text-[#0D2240]">{SERVICE_LABEL[type] ?? type}</span>
                        <span className="text-gray-500">
                          {fmt$(d.revCents)} · {d.orders} orders
                          {d.lbs > 0 ? ` · ${d.lbs.toFixed(0)} lbs` : ""}
                          {" · "}{pct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div className="bg-[#0D2240] h-2.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>

        {/* Daily recap */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-extrabold text-[#0D2240] text-sm">Daily Activity (most recent first)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Date","Deliveries","Revenue","Pickups","Drop-offs"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dailyEntries.map(([day, d]) => (
                  <tr key={day} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-xs font-mono text-gray-500">{day}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-[#0D2240]">{d.orders   || "—"}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-[#0D2240]">{d.revCents > 0 ? fmt$(d.revCents) : "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{d.pickups    || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{d.deliveries || "—"}</td>
                  </tr>
                ))}
                {dailyEntries.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">No activity in this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* ── SECTION: Cancelled Orders ─────────────────────────────────── */}
      <Section title="Cancelled Orders" emoji="❌">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <StatCard label="Cancelled This Period" value={fmtN(cancelled.length)} />
          <StatCard label="Revenue Lost"          value={fmt$(totalCancelledRev)} sub="if all had been delivered" />
          <StatCard label="Cancel Rate"           value={
            (bookings.length + cancelled.length) > 0
              ? `${((cancelled.length / (bookings.length + cancelled.length)) * 100).toFixed(1)}%`
              : "—"
          } />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-extrabold text-[#0D2240] text-sm">Cancelled Orders</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Date","Customer","Service","Est. Value","Pickup Date"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {cancelled.map(b => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-400">{b.created_at.split("T")[0]}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-[#0D2240] text-xs">{b.customer_name}</p>
                    <p className="text-[10px] text-gray-400">{b.customer_email ?? b.customer_phone}</p>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{SERVICE_LABEL[b.service_type] ?? b.service_type}</td>
                  <td className="px-4 py-2.5 text-xs font-semibold text-gray-500">{b.total_amount ? fmt$(b.total_amount) : "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-400">{b.pickup_date ?? "—"}</td>
                </tr>
              ))}
              {cancelled.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No cancellations in this period. 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── SECTION: Driver Activity ───────────────────────────────────── */}
      <Section title="Driver Activity" emoji="🚐">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Pickups"         value={fmtN(totalPickups)}    sub="in period" />
          <StatCard label="Deliveries"      value={fmtN(totalDeliveries)} sub="in period" />
          <StatCard label="Total Stops"     value={fmtN(totalPickups + totalDeliveries)} />
          <StatCard label="Avg Daily Stops" value={
            dailyEntries.length > 0
              ? ((totalPickups + totalDeliveries) / dailyEntries.length).toFixed(1)
              : "—"
          } />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-extrabold text-[#0D2240] text-sm">Daily Driver Activity</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Date","Pickups","Deliveries","Total Stops"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dailyEntries.filter(([, d]) => d.pickups > 0 || d.deliveries > 0).map(([day, d]) => (
                  <tr key={day} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-xs font-mono text-gray-500">{day}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-blue-700">{d.pickups    || "—"}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-green-700">{d.deliveries || "—"}</td>
                    <td className="px-4 py-2.5 text-xs font-bold text-[#0D2240]">{d.pickups + d.deliveries || "—"}</td>
                  </tr>
                ))}
                {dailyEntries.filter(([, d]) => d.pickups > 0 || d.deliveries > 0).length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">No pickups or deliveries in this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* ── SECTION: Customers ────────────────────────────────────────── */}
      <Section title="Customers" emoji="👥">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Unique Customers"   value={fmtN(totalCusts)} sub="in period" />
          <StatCard label="Repeat Customers"   value={fmtN(repeatCusts)} sub={totalCusts ? `${((repeatCusts/totalCusts)*100).toFixed(0)}% of total` : "—"} />
          <StatCard label="New Customers"      value={fmtN(totalCusts - repeatCusts)} />
          <StatCard label="Avg Orders / Cust"  value={(totalCusts ? totalOrders / totalCusts : 0).toFixed(1)} />
        </div>

        {/* Repeat vs new bar */}
        {totalCusts > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
            <h3 className="font-extrabold text-[#0D2240] text-sm mb-3">Repeat vs New</h3>
            <div className="flex h-5 rounded-full overflow-hidden gap-0.5">
              <div className="bg-[#0D2240] h-full transition-all" style={{ width: `${(repeatCusts/totalCusts)*100}%` }} />
              <div className="bg-[#E8726A] h-full flex-1" />
            </div>
            <div className="flex gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#0D2240] rounded-sm inline-block" /> Repeat ({repeatCusts})</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#E8726A] rounded-sm inline-block" /> New ({totalCusts - repeatCusts})</span>
            </div>
          </div>
        )}

        {/* Top customers table + CSV export */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <h3 className="font-extrabold text-[#0D2240] text-sm">Top Customers by Revenue</h3>
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`}
              download={`customers-${from}-${to}.csv`}
              className="text-[11px] font-bold text-[#0D2240] bg-gray-100 hover:bg-[#0D2240] hover:text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              ⬇ Export CSV
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["#","Customer","Orders","Revenue","Pounds","Last Order","Badge"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topCustomers.map((c, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-400 font-bold">{i + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#0D2240] text-xs">{c.name}</p>
                      <p className="text-[10px] text-gray-400 truncate max-w-[160px]">{c.email || c.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-[#0D2240]">{c.orders}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-[#0D2240]">{fmt$(c.revCents)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{c.lbs > 0 ? `${c.lbs.toFixed(1)} lbs` : "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{c.lastOrder.split("T")[0]}</td>
                    <td className="px-4 py-3">
                      {c.orders > 1
                        ? <span className="text-[9px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full uppercase">Repeat</span>
                        : <span className="text-[9px] font-bold bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full uppercase">New</span>
                      }
                    </td>
                  </tr>
                ))}
                {topCustomers.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-400">No delivered orders in this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* ── SECTION: Re-engage ───────────────────────────────────────── */}
      <Section title="Re-Engage Customers" emoji="💌">
        <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-3 mb-5 text-xs text-amber-700 font-medium">
          Based on all-time order history — customers who haven&apos;t placed an order in 30+ days.
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="30–59 Days Inactive"  value={fmtN(re30)}  sub="could order again" />
          <StatCard label="60–89 Days Inactive"  value={fmtN(re60)}  sub="at risk of churning" />
          <StatCard label="90+ Days Inactive"    value={fmtN(re90)}  sub="likely churned" accent />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-extrabold text-[#0D2240] text-sm">Inactive Customer List</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Customer","Contact","Last Order","Days Since","Status"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reEngage.slice(0, 30).map((c, i) => {
                  const days = daysSince(c.lastOrder)
                  const color = days >= 90 ? "bg-red-50 text-red-700" : days >= 60 ? "bg-amber-50 text-amber-700" : "bg-yellow-50 text-yellow-700"
                  const label = days >= 90 ? "Churned" : days >= 60 ? "At Risk" : "Dormant"
                  return (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-semibold text-[#0D2240] text-xs">{c.name}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 truncate max-w-[160px]">{c.email || c.phone}</td>
                      <td className="px-4 py-2.5 text-xs font-mono text-gray-400">{c.lastOrder.split("T")[0]}</td>
                      <td className="px-4 py-2.5 text-xs font-bold text-[#0D2240]">{days}d ago</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${color}`}>{label}</span>
                      </td>
                    </tr>
                  )
                })}
                {reEngage.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">All customers have ordered recently! 🎉</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {reEngage.length > 30 && (
            <div className="px-6 py-3 bg-gray-50 text-xs text-gray-400 border-t border-gray-100">
              Showing 30 of {reEngage.length} inactive customers.
            </div>
          )}
        </div>
      </Section>

      {/* ── SECTION: Subscriptions ─────────────────────────────────────── */}
      <Section title="Subscriptions" emoji="🔄">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Active Subs"     value={fmtN(activeSubs.length)}    accent />
          <StatCard label="Paused"          value={fmtN(pausedSubs.length)}    />
          <StatCard label="Cancelled"       value={fmtN(cancelledSubs.length)} />
          <StatCard label="Total Recurring" value={fmtN(subs.length)}          sub="all time" />
        </div>
        {activeSubs.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-extrabold text-[#0D2240] text-sm">Active Recurring Customers</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Customer","Email","Frequency","Rate","Next Pickup"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activeSubs.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-semibold text-[#0D2240] text-xs">{s.customer_name}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">{s.customer_email}</td>
                    <td className="px-4 py-2.5 text-xs capitalize text-gray-500">{s.frequency}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-[#0D2240]">
                      {s.price_per_lb_cents ? `$${(s.price_per_lb_cents / 100).toFixed(2)}/lb` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">{s.next_pickup_date ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {activeSubs.length === 0 && (
          <div className="bg-gray-50 rounded-2xl p-6 text-center text-sm text-gray-400">
            No active subscriptions yet. Recurring customers will appear here.
          </div>
        )}
      </Section>

      {/* ── SECTION: Workers & Payouts ────────────────────────────────── */}
      <Section title="Workers & Payouts" emoji="👷">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <StatCard label="Active Workers"  value={fmtN(activeWorkers.length)} />
          <StatCard label="Total Workers"   value={fmtN(workers.length)} />
          <StatCard label="Paid Out"        value={fmt$(totalPaidCents)} sub={`in period: ${from} → ${to}`} />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-extrabold text-[#0D2240] text-sm">Payout Summary by Worker</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Worker","Roles","Status","Paid This Period"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {workers.map(w => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-[#0D2240] text-xs">{(w as any).name ?? ""}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{(w.roles as string[]).join(", ")}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      w.status === "active"   ? "bg-green-50 text-green-700" :
                      w.status === "approved" ? "bg-blue-50 text-blue-700"  :
                      "bg-gray-100 text-gray-500"
                    }`}>{w.status}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#0D2240] text-xs">
                    {workerPay[w.id] ? fmt$(workerPay[w.id]) : "—"}
                  </td>
                </tr>
              ))}
              {workers.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">No workers yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── SECTION: Promotions & Discounts ──────────────────────────── */}
      <Section title="Promotions & Discounts" emoji="🏷️">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <StatCard label="Active Promo Codes" value={fmtN(promoCodes.filter(p => (p as any).active !== false).length)} />
          <StatCard label="Uses in Period"     value={fmtN(Object.values(promoUsage).reduce((s, p) => s + p.orders, 0))} />
          <StatCard label="Savings Given"      value={fmt$(totalPromoSavings)} sub="customer discounts in period" />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-extrabold text-[#0D2240] text-sm">Promo Code Performance</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Code","Discount","Total Uses (all-time)","Used in Period","Savings in Period"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {promoCodes
                .sort((a, b) => (b.current_uses ?? 0) - (a.current_uses ?? 0))
                .map(p => {
                  const u      = promoUsage[p.code] ?? { orders: 0, savCents: 0 }
                  const disc   = p.discount_type === "percent" ? `${p.discount_value}% off` : fmt$(p.discount_value * 100)
                  return (
                    <tr key={p.code} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-bold text-[#0D2240] text-xs">{p.code}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        <span className="bg-gray-100 text-gray-600 text-[9px] font-bold px-1.5 py-0.5 rounded-full">{disc}</span>
                        {p.description && <span className="ml-2 text-gray-400">{p.description}</span>}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-[#0D2240]">{p.current_uses ?? 0}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-[#0D2240]">{u.orders || "—"}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-[#0D2240]">{u.savCents > 0 ? fmt$(u.savCents) : "—"}</td>
                    </tr>
                  )
                })}
              {promoCodes.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">No promo codes yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

    </div>
  )
}
