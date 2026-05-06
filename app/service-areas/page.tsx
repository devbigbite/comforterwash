import { createClient } from "@/lib/supabase/server"
import { ServiceAreaMap } from "@/components/service-area-map"
import { getServiceAreaPolygon } from "@/app/actions/settings"

export const metadata = {
  title: "Service Areas | WashFold Orlando",
  description: "WashFold provides free laundry pickup and delivery across the Orlando metro area. Check if we serve your ZIP code.",
}

export const dynamic = "force-dynamic"

export default async function ServiceAreasPage() {
  const supabase = await createClient()
  const [{ data: areas }, polygon] = await Promise.all([
    supabase
      .from("service_areas")
      .select("zip_code, city, active")
      .order("city")
      .order("zip_code"),
    getServiceAreaPolygon(),
  ])

  const activeAreas = (areas ?? []).filter(a => a.active)
  const cities = [...new Set(activeAreas.map(a => a.city))].sort()

  return (
    <main className="min-h-screen bg-white font-sans">

      {/* Header */}
      <div className="bg-[#0D2240] py-14 px-4 text-center">
        <p className="text-[#E8726A] font-bold text-xs uppercase tracking-[0.25em] mb-3">WashFold Orlando</p>
        <h1 className="text-white font-extrabold text-4xl md:text-5xl leading-tight mb-4">
          Pickup &amp; Delivery<br />Service Areas
        </h1>
        <p className="text-white/70 text-base md:text-lg max-w-xl mx-auto">
          We serve the greater Orlando metro — free pickup and delivery straight to your door.
        </p>
        <a href="/#services"
          className="inline-block mt-6 bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-8 py-3.5 rounded-full uppercase tracking-wide transition-colors shadow-lg">
          Schedule a Pickup
        </a>
      </div>

      {/* Map */}
      <div className="mx-auto max-w-4xl px-4 py-10">
        <ServiceAreaMap polygon={polygon} />

        <p className="text-center text-xs text-gray-400 mt-3">
          Shaded area shows our delivery zone. Use the ZIP checker below to confirm your address.
        </p>
      </div>

      {/* ZIP code grid by city */}
      <div className="mx-auto max-w-4xl px-4 pb-16 space-y-8">
        <h2 className="text-2xl font-extrabold text-[#0D2240] text-center">Areas We Serve</h2>

        {cities.length === 0 ? (
          <p className="text-center text-gray-400">Service area details coming soon.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map(city => {
              const zips = activeAreas.filter(a => a.city === city)
              return (
                <div key={city} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
                  <h3 className="font-extrabold text-[#0D2240] mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#E8726A] inline-block shrink-0" />
                    {city}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {zips.map(z => (
                      <span key={z.zip_code}
                        className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#0D2240]/5 text-[#0D2240]">
                        {z.zip_code}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* CTA strip */}
        <div className="rounded-2xl bg-[#0D2240] p-8 text-center mt-4">
          <p className="text-white font-extrabold text-xl mb-2">Don&apos;t see your ZIP code?</p>
          <p className="text-white/60 text-sm mb-5">We&apos;re expanding fast. Reach out and we&apos;ll let you know when we&apos;re in your area.</p>
          <a href="tel:4075550100"
            className="inline-block bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-8 py-3 rounded-full uppercase tracking-wide transition-colors">
            Call Us
          </a>
        </div>
      </div>

    </main>
  )
}
