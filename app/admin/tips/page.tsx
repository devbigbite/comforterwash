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
    <div className="mx-auto max-w-3xl px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0D2240]">Tip Pool</h1>
        <p className="text-sm text-gray-500 mt-1">Tips are split equally among all staff who worked that week.</p>
      </div>
      <TipPoolManager weekSummary={weekSummary} workers={workers} history={history} />
    </div>
  )
}
