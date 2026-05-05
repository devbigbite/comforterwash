import { createAdminClient } from "@/lib/supabase/admin"

// ─── helpers ────────────────────────────────────────────────────────────────
function fmt$(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtN(n: number) {
  return n.toLocaleString("en-US")
}
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

const SERVICE_LABEL: Record<string, string> = {
  comforter_wash: "Comforter",
  wash_fold:      "Wash & Fold",
  wash_only:      "Wash Only",
}

// ─── data fetching ───────────────────────────────────────────────────────────
async function getReportData() {
  const supabase = createAdminClient()
  const now = new Date()
  const thisYear = now.getFullYear()
  const lastYear = thisYear - 1

  // All completed bookings (delivered or in-progress counts too)
  const { data: bookings = [] } = await supabase
    .from("bookings")
    .select("id, created_at, customer_name, customer_email, customer_phone, service_type, status, total_amount, actual_weight_lbs, num_comforters, comforter_size, promo_code, promo_discount_cents, pickup_date")
    .neq("status", "cancelled")
    .order("created_at", { ascending: true })

  // Promo codes usage
  const { data: promoCodes = [] } = await supabase
    .from("promo_codes")
    .select("code, description, current_uses, discount_type, discount_value")

  // Workers with payout info
  const { data: workers = [] } = await supabase
    .from("workers")
    .select("id, full_name, roles, status")

  const { data: payouts = [] } = await supabase
    .from("worker_payouts")
    .select("worker_id, amount_cents, payout_type, created_at, notes")

  return { bookings: bookings ?? [], promoCodes: promoCodes ?? [], workers: workers ?? [], payouts: payouts ?? [], now, thisYear, lastYear }
}

// ─── sub-components (server) ─────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-extrabold text-[#0D2240]">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── page ────────────────────────────────────────────────────────────────────
export default async function ReportsPage() {
  const { bookings, promoCodes, workers, payouts, now, thisYear } = await getReportData()

  const delivered = bookings.filter(b => b.status === "delivered")
  const allActive = bookings // non-cancelled

  // ── Business Performance ──────────────────────────────────────────────────
  const totalRevenueCents = delivered.reduce((s, b) => s + (b.total_amount ?? 0), 0)
  const totalOrders       = delivered.length
  const totalLbs          = delivered.reduce((s, b) => s + (b.actual_weight_lbs ?? 0), 0)
  const avgOrderCents     = totalOrders ? Math.round(totalRevenueCents / totalOrders) : 0

  // Monthly revenue for this year
  const monthlyRevenue: number[] = Array(12).fill(0)
  const monthlyOrders: number[]  = Array(12).fill(0)
  delivered.forEach(b => {
    const d = new Date(b.created_at)
    if (d.getFullYear() === thisYear) {
      monthlyRevenue[d.getMonth()] += b.total_amount ?? 0
      monthlyOrders[d.getMonth()]++
    }
  })
  const maxMonthly = Math.max(...monthlyRevenue, 1)

  // Revenue by service type
  const byService: Record<string, { orders: number; revenueCents: number }> = {}
  delivered.forEach(b => {
    const key = b.service_type ?? "unknown"
    if (!byService[key]) byService[key] = { orders: 0, revenueCents: 0 }
    byService[key].orders++
    byService[key].revenueCents += b.total_amount ?? 0
  })

  // ── Customers ─────────────────────────────────────────────────────────────
  const custMap: Record<string, { name: string; orders: number; revenueCents: number; lastOrder: string }> = {}
  delivered.forEach(b => {
    const key = b.customer_email ?? b.customer_phone ?? b.customer_name
    if (!custMap[key]) custMap[key] = { name: b.customer_name, orders: 0, revenueCents: 0, lastOrder: b.created_at }
    custMap[key].orders++
    custMap[key].revenueCents += b.total_amount ?? 0
    if (b.created_at > custMap[key].lastOrder) custMap[key].lastOrder = b.created_at
  })
  const customers = Object.values(custMap).sort((a, b) => b.revenueCents - a.revenueCents)
  const totalCustomers  = customers.length
  const repeatCustomers = customers.filter(c => c.orders > 1).length
  const newCustomers    = totalCustomers - repeatCustomers
  const topCustomers    = customers.slice(0, 10)

  // Orders placed this month (pending/confirmed/in-progress included)
  const thisMonth = now.getMonth()
  const ordersThisMonth = allActive.filter(b => {
    const d = new Date(b.created_at)
    return d.getFullYear() === thisYear && d.getMonth() === thisMonth
  }).length
  const revenueThisMonthCents = delivered.filter(b => {
    const d = new Date(b.created_at)
    return d.getFullYear() === thisYear && d.getMonth() === thisMonth
  }).reduce((s, b) => s + (b.total_amount ?? 0), 0)

  // Last 7 days daily recap
  const daily: Record<string, { orders: number; revenueCents: number }> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    daily[d.toISOString().split("T")[0]] = { orders: 0, revenueCents: 0 }
  }
  delivered.forEach(b => {
    const day = b.created_at.split("T")[0]
    if (daily[day]) {
      daily[day].orders++
      daily[day].revenueCents += b.total_amount ?? 0
    }
  })

  // ── Promo usage ───────────────────────────────────────────────────────────
  const promoUsage: Record<string, { orders: number; savingsCents: number }> = {}
  delivered.forEach(b => {
    if (b.promo_code) {
      if (!promoUsage[b.promo_code]) promoUsage[b.promo_code] = { orders: 0, savingsCents: 0 }
      promoUsage[b.promo_code].orders++
      promoUsage[b.promo_code].savingsCents += b.promo_discount_cents ?? 0
    }
  })
  const totalPromoSavings = Object.values(promoUsage).reduce((s, p) => s + p.savingsCents, 0)

  // ── Workers/payouts ───────────────────────────────────────────────────────
  const workerPayMap: Record<string, number> = {}
  payouts.forEach(p => {
    workerPayMap[p.worker_id] = (workerPayMap[p.worker_id] ?? 0) + (p.amount_cents ?? 0)
  })
  const activeWorkers = workers.filter(w => w.status === "active")
  const totalPaidOutCents = Object.values(workerPayMap).reduce((s, v) => s + v, 0)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-[#0D2240]">Reports</h1>
        <p className="text-sm text-gray-400">Business performance, customers, workers, and promotions</p>
      </div>

      {/* ── SECTION: Business Performance ─────────────────────────────────── */}
      <Section title="Business Performance">

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Revenue" value={fmt$(totalRevenueCents)} sub="all delivered orders" />
          <StatCard label="Total Orders" value={fmtN(totalOrders)} sub="delivered" />
          <StatCard label="Total Pounds" value={`${fmtN(Math.round(totalLbs))} lbs`} sub="wash & fold + wash only" />
          <StatCard label="Avg Order Value" value={fmt$(avgOrderCents)} />
        </div>

        {/* This month highlight */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[#0D2240] rounded-2xl p-5 text-white">
            <p className="text-xs font-bold text-white/50 uppercase tracking-wide mb-1">{MONTH_NAMES[thisMonth]} Revenue</p>
            <p className="text-3xl font-extrabold">{fmt$(revenueThisMonthCents)}</p>
          </div>
          <div className="bg-[#E8726A] rounded-2xl p-5 text-white">
            <p className="text-xs font-bold text-white/50 uppercase tracking-wide mb-1">{MONTH_NAMES[thisMonth]} Orders</p>
            <p className="text-3xl font-extrabold">{ordersThisMonth}</p>
          </div>
        </div>

        {/* Monthly revenue bar chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h3 className="font-extrabold text-[#0D2240] text-sm mb-4">{thisYear} Monthly Revenue</h3>
          <div className="flex items-end gap-2 h-40">
            {monthlyRevenue.map((cents, i) => {
              const pct = maxMonthly > 0 ? (cents / maxMonthly) * 100 : 0
              const isCurrent = i === thisMonth
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] text-gray-400 font-mono">{cents > 0 ? fmt$(cents) : ""}</span>
                  <div
                    className={`w-full rounded-t-lg transition-all ${isCurrent ? "bg-[#E8726A]" : "bg-[#0D2240]/20"}`}
                    style={{ height: `${Math.max(pct, cents > 0 ? 4 : 0)}%` }}
                  />
                  <span className="text-[9px] font-bold text-gray-400">{MONTH_NAMES[i]}</span>
                  <span className="text-[9px] text-gray-300">{monthlyOrders[i] > 0 ? `${monthlyOrders[i]}` : ""}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Revenue by service */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h3 className="font-extrabold text-[#0D2240] text-sm mb-4">Revenue by Service</h3>
          <div className="space-y-3">
            {Object.entries(byService).sort((a,b) => b[1].revenueCents - a[1].revenueCents).map(([type, d]) => {
              const pct = totalRevenueCents > 0 ? (d.revenueCents / totalRevenueCents) * 100 : 0
              return (
                <div key={type}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-[#0D2240]">{SERVICE_LABEL[type] ?? type}</span>
                    <span className="text-gray-500">{fmt$(d.revenueCents)} · {d.orders} orders · {pct.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-[#0D2240] h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
            {Object.keys(byService).length === 0 && <p className="text-sm text-gray-400">No delivered orders yet.</p>}
          </div>
        </div>

        {/* Last 7 days daily recap */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-extrabold text-[#0D2240] text-sm mb-4">Last 7 Days</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["Date","Orders","Revenue"].map(h => (
                  <th key={h} className="pb-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {Object.entries(daily).reverse().map(([day, d]) => (
                <tr key={day} className="hover:bg-gray-50">
                  <td className="py-2 text-xs font-mono text-gray-500">{day}</td>
                  <td className="py-2 text-xs font-semibold text-[#0D2240]">{d.orders || "—"}</td>
                  <td className="py-2 text-xs font-semibold text-[#0D2240]">{d.revenueCents > 0 ? fmt$(d.revenueCents) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── SECTION: Customers ────────────────────────────────────────────── */}
      <Section title="Customers">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Customers" value={fmtN(totalCustomers)} />
          <StatCard label="Repeat Customers" value={fmtN(repeatCustomers)} sub={`${totalCustomers ? ((repeatCustomers/totalCustomers)*100).toFixed(0) : 0}% of all`} />
          <StatCard label="New Customers" value={fmtN(newCustomers)} />
          <StatCard label="Avg Orders / Customer" value={(totalCustomers ? totalOrders / totalCustomers : 0).toFixed(1)} />
        </div>

        {/* Repeat vs new visual */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h3 className="font-extrabold text-[#0D2240] text-sm mb-3">Repeat vs New</h3>
          <div className="flex h-6 rounded-full overflow-hidden gap-0.5">
            {totalCustomers > 0 ? (
              <>
                <div className="bg-[#0D2240] h-full transition-all" style={{ width: `${(repeatCustomers/totalCustomers)*100}%` }} title="Repeat" />
                <div className="bg-[#E8726A] h-full flex-1" title="New" />
              </>
            ) : (
              <div className="bg-gray-100 h-full w-full rounded-full" />
            )}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#0D2240] rounded-sm inline-block" /> Repeat</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#E8726A] rounded-sm inline-block" /> New</span>
          </div>
        </div>

        {/* Top customers table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-extrabold text-[#0D2240] text-sm">Top Customers by Revenue</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["#","Customer","Orders","Revenue","Last Order"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {topCustomers.map((c, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-400 font-bold">{i + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#0D2240] text-xs">{c.name}</p>
                    {c.orders > 1 && <span className="text-[9px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full uppercase">Repeat</span>}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-[#0D2240]">{c.orders}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-[#0D2240]">{fmt$(c.revenueCents)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{c.lastOrder.split("T")[0]}</td>
                </tr>
              ))}
              {topCustomers.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">No customer data yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── SECTION: Workers & Payouts ────────────────────────────────────── */}
      <Section title="Workers & Payouts">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <StatCard label="Active Workers" value={fmtN(activeWorkers.length)} />
          <StatCard label="Total Workers" value={fmtN(workers.length)} />
          <StatCard label="Total Paid Out" value={fmt$(totalPaidOutCents)} sub="all time" />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-extrabold text-[#0D2240] text-sm">Payout Summary by Worker</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Worker","Roles","Status","Total Paid"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {workers.map(w => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-[#0D2240] text-xs">{w.full_name}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{(w.roles as string[]).join(", ")}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      w.status === "active" ? "bg-green-50 text-green-700" :
                      w.status === "approved" ? "bg-blue-50 text-blue-700" :
                      "bg-gray-100 text-gray-500"
                    }`}>{w.status}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#0D2240] text-xs">
                    {workerPayMap[w.id] ? fmt$(workerPayMap[w.id]) : "—"}
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

      {/* ── SECTION: Promotions ───────────────────────────────────────────── */}
      <Section title="Promotions & Discounts">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <StatCard label="Active Promo Codes" value={fmtN(promoCodes.filter(p => (p as any).active !== false).length)} />
          <StatCard label="Total Promo Uses" value={fmtN(promoCodes.reduce((s, p) => s + (p.current_uses ?? 0), 0))} />
          <StatCard label="Total Savings Given" value={fmt$(totalPromoSavings)} sub="customer savings" />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-extrabold text-[#0D2240] text-sm">Promo Code Performance</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Code","Description","Uses","Savings Given"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {promoCodes
                .sort((a, b) => (b.current_uses ?? 0) - (a.current_uses ?? 0))
                .map(p => {
                  const usage = promoUsage[p.code] ?? { orders: 0, savingsCents: 0 }
                  const discLabel = p.discount_type === "percent"
                    ? `${p.discount_value}% off`
                    : fmt$(p.discount_value * 100)
                  return (
                    <tr key={p.code} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-bold text-[#0D2240] text-xs">{p.code}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {p.description || "—"}
                        <span className="ml-2 text-[9px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{discLabel}</span>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-[#0D2240]">{p.current_uses ?? 0}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-[#0D2240]">
                        {usage.savingsCents > 0 ? fmt$(usage.savingsCents) : "—"}
                      </td>
                    </tr>
                  )
                })}
              {promoCodes.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">No promo codes yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}

// ─── Section wrapper ─────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-base font-extrabold text-[#0D2240] uppercase tracking-wide">{title}</h2>
        <div className="flex-1 h-px bg-gray-100" />
      </div>
      {children}
    </section>
  )
}
