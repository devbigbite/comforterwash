import { createAdminClient } from "@/lib/supabase/admin"
import { ZipChecker } from "@/components/zip-checker"
import { MessageUsModal } from "@/components/message-us-modal"
import en from "@/lib/translations/en"
import es from "@/lib/translations/es"

export const metadata = {
  title: "Service Areas | WashFold Orlando",
  description: "WashFold provides free laundry pickup and delivery across the Orlando metro area. Check if we serve your ZIP code.",
}

export const dynamic = "force-dynamic"

export default async function ServiceAreasPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>
}) {
  const { lang } = await searchParams
  const tr = lang === "es" ? es.serviceAreasPage : en.serviceAreasPage

  const supabase = createAdminClient()
  const { data: areas } = await supabase
    .from("service_areas")
    .select("zip_code, city, notes, active")
    .eq("active", true)
    .order("zip_code")

  const activeAreas = areas ?? []
  const titleLines = tr.title.split("\n")

  return (
    <main className="min-h-screen bg-white font-sans">

      {/* Header */}
      <div className="bg-[#0D2240] py-14 px-4 text-center">
        <p className="text-[#E8726A] font-bold text-xs uppercase tracking-[0.25em] mb-3">{tr.badge}</p>
        <h1 className="text-white font-extrabold text-4xl md:text-5xl leading-tight mb-4">
          {titleLines[0]}<br />{titleLines[1]}
        </h1>
        <p className="text-white/70 text-base md:text-lg max-w-xl mx-auto">
          {tr.subtitle}
        </p>
        <a href={lang === "es" ? "/#services?lang=es" : "/#services"}
          className="inline-block mt-6 bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-8 py-3.5 rounded-full uppercase tracking-wide transition-colors shadow-lg">
          {tr.scheduleBtn}
        </a>
      </div>

      {/* ZIP checker */}
      <div className="bg-gray-50 border-b border-gray-100 py-8 px-4">
        <div className="max-w-md mx-auto text-center">
          <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">{tr.checkZip}</p>
          <ZipChecker />
        </div>
      </div>

      {/* ZIP cards */}
      <div className="mx-auto max-w-4xl px-4 py-12">
        <h2 className="text-2xl font-extrabold text-[#0D2240] text-center mb-2">{tr.areasTitle}</h2>
        <p className="text-center text-sm text-gray-400 mb-8">
          {activeAreas.length} {activeAreas.length !== 1 ? tr.zipCounts : tr.zipCount} {tr.acrossOrlando}
        </p>

        {activeAreas.length === 0 ? (
          <p className="text-center text-gray-400">{tr.comingSoon}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeAreas.map(area => (
              <div key={area.zip_code} className="group rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-[#E8726A]/30 transition-all p-6">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className="text-3xl">📍</span>
                  <span className="text-xs font-bold bg-[#0D2240]/5 text-[#0D2240] px-2.5 py-1 rounded-full">
                    {area.city}
                  </span>
                </div>
                <p className="text-3xl font-extrabold text-[#0D2240] tracking-tight mb-1">{area.zip_code}</p>
                {area.notes && (
                  <p className="text-sm text-gray-500 font-medium leading-snug">{area.notes}</p>
                )}
                <div className="mt-4 pt-3 border-t border-gray-50 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                  <span className="text-xs font-semibold text-green-600">{tr.servingThis}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA strip */}
        <div className="rounded-2xl bg-[#0D2240] p-8 text-center mt-10">
          <p className="text-white font-extrabold text-xl mb-2">{tr.noZip}</p>
          <p className="text-white/60 text-sm mb-5">{tr.noZipSub}</p>
          <MessageUsModal
            label={tr.messageUs}
            className="inline-block bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-8 py-3 rounded-full uppercase tracking-wide transition-colors cursor-pointer"
          />
        </div>
      </div>

    </main>
  )
}
