import { requireAdmin } from "@/lib/auth-guard"
import { getExpenses, deleteExpense } from "@/app/actions/expenses"
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories"
import { ExpenseForm } from "@/components/admin/ExpenseForm"
import { DateFilter } from "@/app/admin/reports/date-filter"

function fmt$(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map(c => [c.value, c.label]),
)

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams
  const now = new Date()
  const defaultTo = now.toISOString().split("T")[0]
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  const from = sp.from ?? defaultFrom
  const to = sp.to ?? defaultTo

  const expenses = await getExpenses(from, to)
  const totalCents = expenses.reduce((s, e) => s + e.amount_cents, 0)

  const byCategory: Record<string, number> = {}
  expenses.forEach(e => { byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount_cents })

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-xl font-extrabold text-[#0D2240] mb-1">💸 Expenses</h1>
      <p className="text-sm text-gray-400 mb-6">Log operating costs — rent, supplies, marketing, and everything else that isn&apos;t a driver/operator payout.</p>

      <DateFilter from={from} to={to} />

      <div className="mb-8">
        <ExpenseForm />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Total logged this range</p>
        <p className="text-2xl font-extrabold text-[#0D2240]">{fmt$(totalCents)}</p>
        {Object.keys(byCategory).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(byCategory).sort(([, a], [, b]) => b - a).map(([cat, cents]) => (
              <span key={cat} className="text-xs bg-gray-100 text-gray-500 rounded-lg px-2.5 py-1">
                {CATEGORY_LABEL[cat] ?? cat}: <span className="font-bold text-[#0D2240]">{fmt$(cents)}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
        {expenses.length === 0 && (
          <p className="text-sm text-gray-400 px-5 py-8 text-center">No expenses logged for this range.</p>
        )}
        {expenses.map(e => (
          <div key={e.id} className="flex items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#0D2240]">
                {CATEGORY_LABEL[e.category] ?? e.category}
                <span className="ml-2 text-xs font-normal text-gray-400">{e.expense_date}</span>
              </p>
              {e.note && <p className="text-xs text-gray-400 truncate">{e.note}</p>}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm font-bold text-[#0D2240]">{fmt$(e.amount_cents)}</span>
              <form action={deleteExpense}>
                <input type="hidden" name="id" value={e.id} />
                <button type="submit" className="text-xs font-bold text-red-400 hover:text-red-600 transition-colors">
                  Delete
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
