"use client"
import { useActionState, useRef, useEffect } from "react"
import { addExpense, EXPENSE_CATEGORIES } from "@/app/actions/expenses"

const initialState: { success?: boolean; error?: string } = {}
const inp = "rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 bg-white w-full"

export function ExpenseForm() {
  const [state, formAction, pending] = useActionState(addExpense, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.success) formRef.current?.reset()
  }, [state])

  const today = new Date().toISOString().split("T")[0]

  return (
    <form ref={formRef} action={formAction} className="space-y-3 bg-[#f7f8fb] border border-gray-100 rounded-2xl p-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Date</label>
          <input name="expense_date" type="date" required defaultValue={today} className={inp} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Category</label>
          <select name="category" required defaultValue="" className={inp}>
            <option value="" disabled>Select category…</option>
            {EXPENSE_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Amount ($)</label>
          <input name="amount" type="number" step="0.01" min="0.01" required placeholder="0.00" className={inp} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Note (optional)</label>
        <input name="note" placeholder="e.g. Costco detergent run" className={inp} />
      </div>

      {state.error && (
        <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          ⚠️ {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
          ✓ Expense logged.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="text-xs font-bold text-white bg-[#0D2240] hover:bg-[#16305c] px-4 py-2 rounded-xl transition-colors uppercase tracking-wide disabled:opacity-50"
      >
        {pending ? "Saving…" : "+ Log Expense"}
      </button>
    </form>
  )
}
