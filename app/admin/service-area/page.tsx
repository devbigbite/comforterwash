import { getServiceAreaPolygon } from "@/app/actions/settings"
import { ServiceAreaEditor } from "@/components/admin/service-area-editor"
import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { getApproxCenterForZip } from "@/lib/zcta-boundary"

export const dynamic = "force-dynamic"

// Gives the map a starting view over this tenant's own city instead of a
// hardcoded default -- previously the editor always opened centered on
// Orlando regardless of tenant, which for a tenant with no shape drawn yet
// looked like a blank, broken map with nothing on it (this is what one
// Houston tenant described as the map "taking her out"). Best-effort: uses
// the first ZIP the tenant has already added under Service Area / ZIP
// Codes, via its official Census boundary; falls back to no override
// (a neutral, non-city-specific view) if they haven't added one yet or the
// lookup fails.
async function getInitialMapCenter(locationId: string): Promise<{ lat: number; lng: number } | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("service_areas")
    .select("zip_code")
    .eq("location_id", locationId)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!data?.zip_code) return null
  return getApproxCenterForZip(data.zip_code)
}

export default async function ServiceAreaPage() {
  const locationId = await getLocationId()
  const [polygon, initialCenter] = await Promise.all([
    getServiceAreaPolygon(),
    getInitialMapCenter(locationId),
  ])

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-10">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-[#0D2240]">Service Area Map</h1>
            <p className="text-sm text-gray-400 mt-1">
              Optional — draw a custom delivery-zone shape to show on your Service Areas page.
              Every ZIP you've added under Service Area / ZIP Codes already shows customers its
              own official boundary automatically, even without drawing anything here.
            </p>
          </div>
          <a href="/admin" className="text-sm text-gray-400 hover:text-[#0D2240] transition-colors">
            ← Back to Dashboard
          </a>
        </div>

        <ServiceAreaEditor initialPolygon={polygon} initialCenter={initialCenter} />

      </div>
    </div>
  )
}
