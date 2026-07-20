import { Suspense } from "react"
import { ApplyClient } from "./apply-client"
import { getBranding } from "@/lib/location"

export default async function ApplyPage() {
  const branding = await getBranding()
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#f7f8fb] flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading…</div>
      </main>
    }>
      <ApplyClient businessName={branding.business_name || "Your Business"} />
    </Suspense>
  )
}
