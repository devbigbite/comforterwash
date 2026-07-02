"use client"
import { useState, useTransition } from "react"

export function SeedDispatchButton() {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<string | null>(null)

  function run() {
    startTransition(async () => {
      const res = await fetch("/api/admin/seed-dispatch", { method: "POST" })
      const data = await res.json()
      setResult(`✓ Updated ${data.updated} orders to today (${data.today})`)
      setTimeout(() => { setResult(null); window.location.reload() }, 1500)
    })
  }

  return (
    <div className="flex items-center gap-3">
      {result && <span className="text-xs text-green-600 font-semibold">{result}</span>}
      <button
        type="button"
        onClick={run}
        disabled={isPending}
        className="text-[11px] font-bold text-gray-400 hover:text-[#E8726A] border border-dashed border-gray-200 hover:border-[#E8726A] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
      >
        {isPending ? "Loading..." : "🧪 Load demo orders"}
      </button>
    </div>
  )
}
