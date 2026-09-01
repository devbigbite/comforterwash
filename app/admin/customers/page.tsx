import { requireAdmin } from "@/lib/auth-guard"
import { getCustomersWithSegments } from "@/app/actions/customers"
import { SEGMENT_LABELS, SEGMENT_COLORS } from "@/lib/customer-segments"
import { CustomersTable } from "./customers-table"

export default async function CustomersPage() {
  await requireAdmin()
  const customers = await getCustomersWithSegments()

  const counts = { new: 0, active: 0, at_risk: 0, dormant: 0 } as Record<string, number>
  for (const c of customers) counts[c.segment]++

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-[#0D2240]">Customers</h1>
        <p className="text-sm text-gray-400">
          Every customer who has booked with you, auto-segmented so you know who to reach out to.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {(Object.keys(SEGMENT_LABELS) as (keyof typeof SEGMENT_LABELS)[]).map(seg => (
          <div key={seg} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full mb-2 ${SEGMENT_COLORS[seg]}`}>
              {SEGMENT_LABELS[seg]}
            </p>
            <p className="text-2xl font-extrabold text-[#0D2240]">{counts[seg] ?? 0}</p>
          </div>
        ))}
      </div>

      <CustomersTable customers={customers} />
    </div>
  )
}
