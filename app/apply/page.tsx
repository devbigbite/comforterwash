import { Suspense } from "react"
import { ApplyClient } from "./apply-client"

export default function ApplyPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#f7f8fb] flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading…</div>
      </main>
    }>
      <ApplyClient />
    </Suspense>
  )
}
