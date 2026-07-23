import Link from "next/link"
import { notFound } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import { getSiteLangCookie } from "@/app/actions/site-lang"
import { getServiceAreaPolygon } from "@/app/actions/settings"
import { getBranding, getLocationId } from "@/lib/location"
import { ServiceAreaMap } from "@/components/service-area-map"
import { ZipChecker } from "@/components/zip-checker"
import en from "@/lib/translations/en"
import es from "@/lib/translations/es"

const SERVICE_SLUGS = ["wash-fold", "comforter-wash", "wash-only"] as const

function fillTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(v), template)
}

export async function generateMetadata({ params }: { params: Promise<{ zip: string }> }) {
  const { zip } = await params
  const [supabase, locationId, branding] = [createAdminClient(), await getLocationId(), await getBranding()]
  const { data: area } = await supabase
    .from("service_areas")
    .select("zip_code, city, active")
    .eq("location_id", locationId)
    .eq("zip_code", zip)
    .eq("active", true)
    .single()
  if (!area) return {}

  const name = branding.business_name || "WashFoldClean"
  const vars = { city: area.city, zip: area.zip_code, business: name }
  return {
    title: fillTemplate(en.serviceAreaDetail.metaTitleTemplate, vars),
    description: fillTemplate(en.serviceAreaDetail.metaDescriptionTemplate, vars),
  }
}

export const dynamic = "force-dynamic"

export default async function ServiceAreaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ zip: string }>
  searchParams: Promise<{ lang?: string }>
}) {
  const { zip } = await params
  const { lang: langParam } = await searchParams
  const lang = langParam ?? (await getSiteLangCookie())
  const tr = lang === "es" ? es.serviceAreaDetail : en.serviceAreaDetail
  const svcTr = lang === "es" ? es.servicePages : en.servicePages
  const nav = lang === "es" ? es.faqPage : en.faqPage

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data: area } = await supabase
    .from("service_areas")
    .select("zip_code, city, active, public_blurb")
    .eq("location_id", locationId)
    .eq("zip_code", zip)
    .eq("active", true)
    .single()

  if (!area) notFound()

  const [branding, polygon, { data: otherAreasData }] = await Promise.all([
    getBranding(),
    getServiceAreaPolygon(),
    supabase
      .from("service_areas")
      .select("zip_code, city")
      .eq("location_id", locationId)
      .eq("active", true)
      .neq("zip_code", zip)
      .order("zip_code")
      .limit(8),
  ])

  const name = branding.business_name || "WashFoldClean"
  const vars = { city: area.city, zip: area.zip_code, business: name }
  const intro = area.public_blurb?.trim() || fillTemplate(tr.introTemplate, vars)
  const otherAreas = otherAreasData ?? []

  const lp = (path: string) => (lang === "es" ? `${path}?lang=es` : path)

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-[var(--brand-primary)] px-4 py-16 text-center">
        <p className="text-[var(--brand-accent)] font-bold text-xs uppercase tracking-[0.25em] mb-3">{tr.badge}</p>
        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
          {area.city}, {area.zip_code}
        </h1>
        <p className="text-white/60 text-sm md:text-base mt-4 max-w-xl mx-auto leading-relaxed">
          {intro}
        </p>
        <Link
          href={lp("/#services")}
          className="inline-block mt-7 bg-[var(--brand-accent)] hover:bg-[#d45f57] text-white font-bold text-sm px-8 py-3.5 rounded-full uppercase tracking-wide transition-colors shadow-lg"
        >
          {tr.ctaButton}
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-14">
        {/* Map */}
        <div className="mb-14">
          <h2 className="text-xl font-extrabold text-[var(--brand-primary)] text-center mb-6">{tr.mapHeading}</h2>
          <ServiceAreaMap polygon={polygon} />
        </div>

        {/* Services available */}
        <div className="mb-14">
          <h2 className="text-xl font-extrabold text-[var(--brand-primary)] text-center mb-6">{tr.servicesHeading}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {SERVICE_SLUGS.map(slug => (
              <Link
                key={slug}
                href={lp(`/services/${slug}`)}
                className="flex flex-col items-center text-center gap-2 rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-[var(--brand-accent)] hover:shadow-md transition-all"
              >
                <span className="text-3xl">{svcTr[slug].icon}</span>
                <span className="font-bold text-[var(--brand-primary)] text-sm">{svcTr[slug].heading}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* ZIP checker */}
        <div className="bg-gray-50 border border-gray-100 rounded-2xl py-8 px-4 mb-14 text-center">
          <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">
            {lang === "es" ? "Verifica otro código postal" : "Check another ZIP code"}
          </p>
          <div className="max-w-md mx-auto">
            <ZipChecker />
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-2xl bg-[var(--brand-primary)] p-8 text-center mb-10">
          <p className="text-white font-extrabold text-xl mb-2">{tr.ctaHeading}</p>
          <p className="text-white/60 text-sm mb-5">{tr.ctaSub}</p>
          <Link
            href={lp("/#services")}
            className="inline-block bg-[var(--brand-accent)] hover:bg-[#d45f57] text-white font-bold text-sm px-8 py-3 rounded-full uppercase tracking-wide transition-colors"
          >
            {tr.ctaButton}
          </Link>
        </div>

        {/* Other areas */}
        {otherAreas.length > 0 && (
          <div className="mb-10">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest text-center mb-4">{tr.otherAreasHeading}</h2>
            <div className="flex flex-wrap justify-center gap-2">
              {otherAreas.map(a => (
                <Link
                  key={a.zip_code}
                  href={lp(`/service-areas/${a.zip_code}`)}
                  className="text-xs font-semibold bg-gray-50 hover:bg-[var(--brand-accent)]/10 text-gray-500 hover:text-[var(--brand-accent)] px-3 py-1.5 rounded-full border border-gray-100 transition-colors"
                >
                  {a.city} {a.zip_code}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Footer nav */}
        <div className="border-t border-gray-100 py-6 flex gap-4 text-xs text-gray-400">
          <Link href={lp("/service-areas")} className="hover:text-[var(--brand-accent)] transition-colors">{tr.backToAreas}</Link>
          <Link href={lp("/")} className="hover:text-[var(--brand-accent)] transition-colors">{nav.backHome}</Link>
        </div>
      </div>
    </main>
  )
}
