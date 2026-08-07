"use client"

import { useState, useTransition } from "react"

interface Props {
  bookingId: string
  bagCount: number
  action: (formData: FormData) => Promise<void>
}

// Weighing bag-by-bag is how it actually happens at the scale — one bag at a
// time — and it also catches a miscount before billing happens (if a bag was
// missed or double-counted, the operator/admin sees it immediately instead
// of guessing at a single combined number). The form still calls the same
// recordWeightAndCharge action as everywhere else — it just sums the
// per-bag readings into the one total that function expects.
export function WeightEntryForm({ bookingId, bagCount, action }: Props) {
  const count = Math.max(1, bagCount || 1)
  const [weights, setWeights] = useState<string[]>(Array(count).fill(""))
  const [pending, startTransition] = useTransition()

  const parsed = weights.map(w => parseFloat(w)).filter(n => !isNaN(n) && n > 0)
  const total = parsed.reduce((sum, n) => sum + n, 0)
  const allFilled = weights.every(w => w.trim() !== "" && parseFloat(w) > 0)

  function setWeight(i: number, value: string) {
    setWeights(prev => {
      const next = [...prev]
      next[i] = value
      return next
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!allFilled || total <= 0) return
    const fd = new FormData()
    fd.append("bookingId", bookingId)
    fd.append("weightLbs", String(total))
    startTransition(() => { action(fd) })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {weights.map((w, i) => (
          <div key={i}>
            <label className="text-xs text-gray-400 mb-1 block">Bag {i + 1} (lbs)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={w}
              onChange={e => setWeight(i, e.target.value)}
              placeholder="e.g. 12.5"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="text-sm text-gray-500">
          Total: <span className="font-bold text-[#0D2240]">{total > 0 ? total.toFixed(1) : "—"} lbs</span>
        </div>
        <button
          type="submit"
          disabled={!allFilled || total <= 0 || pending}
          className="rounded-xl bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm px-5 py-2.5 transition-colors"
        >
          {pending ? "Saving…" : "Save Weight & Bill"}
        </button>
      </div>
      <p className="text-xs text-gray-400">
        This calculates and charges the customer, matching what the operator station would do.
      </p>
    </form>
  )
}
