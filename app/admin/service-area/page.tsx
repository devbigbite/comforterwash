import { getServiceAreaPolygon } from "@/app/actions/settings"
import { ServiceAreaEditor } from "@/components/admin/service-area-editor"

export const dynamic = "force-dynamic"

export default async function ServiceAreaPage() {
  const polygon = await getServiceAreaPolygon()

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-10">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-[#0D2240]">Service Area Map</h1>
            <p className="text-sm text-gray-400 mt-1">
              Draw your delivery zone — this is what customers see on the Service Areas page.
            </p>
          </div>
          <a href="/admin" className="text-sm text-gray-400 hover:text-[#0D2240] transition-colors">
            ← Back to Dashboard
          </a>
        </div>

        <ServiceAreaEditor initialPolygon={polygon} />

      </div>
    </div>
  )
}
