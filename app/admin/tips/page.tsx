import { getCurrentWeekSummary, getApprovedWorkers, getTipPoolHistory } from "@/app/actions/tip-pools"
import { TipPoolManager } from "@/components/admin/tip-pool-manager"

export const dynamic = "force-dynamic"

export default async function TipsAdminPage() {
  const [weekSummary, workers, history] = await Promise.all([
    getCurrentWeekSummary(),
    getApprovedWorkers(),
    getTipPoolHistory(),
  ])

  return (
    <div className="min-h-screen bg-[#f8faff]">
      {/* Header */}
      <header className="bg-[#0D2240] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <a href="/admin" className="flex items-center gap-2.5 group">
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="24" r="24" fill="#0D2240" />
              <circle cx="24" cy="24" r="22" fill="#142d52" />
              <path d="M8 24 Q11 19 14 24 Q17 29 20 24 Q23 19 26 24 Q29 29 32 24 Q35 19 38 24"
                stroke="#E8726A" strokeWidth="3" strokeLinecap="round" fill="none" />
            </svg>
            <span className="text-white font-extrabold text-lg tracking-tight group-hover:opacity-80 transition-opacity">
              Wash<span className="text-[#E8726A]">Fold</span>
              <span className="ml-1.5 text-white/40 text-xs font-semibold uppercase tracking-widest">Admin</span>
            </span>
          </a>
        </div>
        <a href="/admin" className="text-white/60 hover:text-white text-sm transition-colors">← Dashboard</a>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0D2240]">Tip Pool</h1>
          <p className="text-sm text-gray-500 mt-1">Tips are split equally among all staff who worked that week.</p>
        </div>

        <TipPoolManager
          weekSummary={weekSummary}
          workers={workers}
          history={history}
        />
      </div>
    </div>
  )
}
