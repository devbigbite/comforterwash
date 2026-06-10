import { Suspense } from "react"
import { AgreementsClient } from "./agreements-client"

export default function AgreementsPage() {
  return (
    <Suspense fallback={
      <div className="p-8 text-gray-400 text-sm">Loading…</div>
    }>
      <AgreementsClient />
    </Suspense>
  )
}
