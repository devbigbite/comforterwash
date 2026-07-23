import Link from "next/link"
import { notFound } from "next/navigation"
import { getSiteLangCookie } from "@/app/actions/site-lang"
import { getBranding } from "@/lib/location"
import en from "@/lib/translations/en"
import es from "@/lib/translations/es"

const SLUGS = ["wash-fold", "comforter-wash", "wash-only"] as const
type ServiceSlug = (typeof SLUGS)[number]

function isServiceSlug(slug: string): slug is ServiceSlug {
  return (SLUGS as readonly string[]).includes(slug)
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!isServiceSlug(slug)) return {}
  const branding = await getBranding()
  const name = branding.business_name || "WashFoldClean"
  const t = en.servicePages[slug]
  return {
    title: `${t.metaTitle} | ${name}`,
    description: t.metaDescription,
  }
}

export const dynamic = "force-dynamic"

export default async function ServiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ lang?: string }>
}) {
  const { slug } = await params
  if (!isServiceSlug(slug)) notFound()

  const { lang: langParam } = await searchParams
  const lang = langParam ?? (await getSiteLangCookie())
  const tr = lang === "es" ? es.servicePages[slug] : en.servicePages[slug]
  const nav = lang === "es" ? es.faqPage : en.faqPage // reuse back/terms/privacy labels
  const branding = await getBranding()
  const name = branding.business_name || "WashFoldClean"

  const bookHref = lang === "es" ? `/book/${slug}?lang=es` : `/book/${slug}`
  const otherServices = SLUGS.filter(s => s !== slug)
  const allTr = lang === "es" ? es.servicePages : en.servicePages

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-[var(--brand-primary)] px-4 py-16 text-center">
        <div className="text-5xl mb-4">{tr.icon}</div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight max-w-2xl mx-auto">
          {tr.heading}
        </h1>
        <p className="text-white/60 text-sm md:text-base mt-4 max-w-xl mx-auto leading-relaxed">
          {tr.intro}
        </p>
        <Link
          href={bookHref}
          className="inline-block mt-7 bg-[var(--brand-accent)] hover:bg-[#d45f57] text-white font-bold text-sm px-8 py-3.5 rounded-full uppercase tracking-wide transition-colors shadow-lg"
        >
          {tr.ctaLabel}
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-14">
        {/* Bullets */}
        <div className="grid gap-5 sm:grid-cols-2 mb-14">
          {tr.bullets.map((b, i) => (
            <div key={i} className="rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="font-extrabold text-[var(--brand-primary)] text-sm mb-1.5">{b.title}</p>
              <p className="text-sm text-gray-500 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mb-14">
          <h2 className="text-2xl font-extrabold text-[var(--brand-primary)] text-center mb-2">
            {lang === "es" ? "Preguntas Frecuentes" : "Frequently Asked Questions"}
          </h2>
          <div className="w-16 h-0.5 bg-[var(--brand-accent)] mx-auto mb-8" />
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 divide-y divide-gray-100">
            {tr.faqs.map((item, i) => (
              <details key={i} className="group py-4">
                <summary className="flex items-center justify-between cursor-pointer list-none select-none">
                  <span className="font-semibold text-[var(--brand-primary)] text-sm pr-4 group-open:text-[var(--brand-accent)] transition-colors">
                    {item.q}
                  </span>
                  <span className="shrink-0 w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 group-open:text-[var(--brand-accent)] group-open:border-[var(--brand-accent)] group-open:rotate-45 transition-all text-sm">
                    +
                  </span>
                </summary>
                <p className="text-sm text-gray-500 leading-relaxed mt-2">{item.a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* Other services */}
        <div className="mb-14">
          <h2 className="text-lg font-extrabold text-[var(--brand-primary)] text-center mb-5">
            {lang === "es" ? "Otros Servicios" : "Other Services"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {otherServices.map(s => (
              <Link
                key={s}
                href={lang === "es" ? `/services/${s}?lang=es` : `/services/${s}`}
                className="flex items-center gap-3 rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-[var(--brand-accent)] hover:shadow-md transition-all"
              >
                <span className="text-2xl">{allTr[s].icon}</span>
                <span className="font-bold text-[var(--brand-primary)] text-sm">{allTr[s].heading}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* CTA strip */}
        <div className="rounded-2xl bg-[var(--brand-primary)] p-8 text-center mb-10">
          <p className="text-white font-extrabold text-xl mb-2">
            {lang === "es" ? `¿Listo para empezar con ${name}?` : `Ready to get started with ${name}?`}
          </p>
          <Link
            href={bookHref}
            className="inline-block bg-[var(--brand-accent)] hover:bg-[#d45f57] text-white font-bold text-sm px-8 py-3 rounded-full uppercase tracking-wide transition-colors"
          >
            {tr.ctaLabel}
          </Link>
        </div>

        {/* Footer nav */}
        <div className="border-t border-gray-100 py-6 flex gap-4 text-xs text-gray-400">
          <Link href={lang === "es" ? "/?lang=es" : "/"} className="hover:text-[var(--brand-accent)] transition-colors">{nav.backHome}</Link>
          <Link href="/service-areas" className="hover:text-[var(--brand-accent)] transition-colors">
            {lang === "es" ? "Áreas de Servicio" : "Service Areas"}
          </Link>
          <Link href="/faq" className="hover:text-[var(--brand-accent)] transition-colors">FAQ</Link>
        </div>
      </div>
    </main>
  )
}
