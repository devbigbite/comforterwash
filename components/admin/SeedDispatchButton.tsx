"use client"
import { useState, useTransition } from "react"

export function SeedDispatchButton() {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<string | null>(null)

  function run() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/seed-dispatch", { method: "POST" })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Demo orders could not be loaded")
        const created = data.created ? `Created ${data.created} and loaded` : "Loaded"
        setResult(`✓ ${created} ${data.updated} demo orders (${data.today})`)
        setTimeout(() => { setResult(null); window.location.reload() }, 1500)
      } catch (error) {
        setResult(`Could not load demo orders: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    })
  }

  return (
    <div className="flex items-center gap-3">
      {result && <span className={`text-xs font-semibold ${result.startsWith("✓") ? "text-green-600" : "text-red-600"}`}>{result}</span>}
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
