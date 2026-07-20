import Link from "next/link"
import { CommercialForm } from "@/components/CommercialForm"
import { getSiteLangCookie } from "@/app/actions/site-lang"
import en from "@/lib/translations/en"
import es from "@/lib/translations/es"

export const metadata = {
  title: "Commercial Laundry Services — WashFold Orlando",
  description:
    "Effective laundry pickup & delivery for Orlando businesses. Hotels, Airbnb hosts, gyms, spas, restaurants, medical offices and more. Get a custom quote today.",
}

// Without this, Next.js statically prerenders this page at build time
// (no other dynamic API is used besides the indirected cookies() call
// inside getSiteLangCookie(), which isn't always enough for Next's static
// analysis to pick up) — baking in whatever locale existed at build time
// forever and ignoring the per-request wf_locale cookie entirely. That's
// why /commercial specifically stayed stuck while /service-areas (which
// already had this) and /faq (revalidate = 60) worked.
export const dynamic = "force-dynamic"

export default async function CommercialPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>
}) {
  const { lang: langParam } = await searchParams
  // Explicit ?lang= wins (shareable links); otherwise fall back to the
  // cookie the EN/ES toggle writes to.
  const lang = langParam ?? (await getSiteLangCookie())
  const tr = lang === "es" ? es.commercialPage : en.commercialPage

  return (
    <main className="min-h-screen bg-[#f7f8fb]">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="bg-[var(--brand-primary)] px-4 py-20 text-center">
        <div className="mx-auto max-w-3xl">
          <span className="inline-block bg-[var(--brand-accent)]/20 text-[var(--brand-accent)] text-xs font-extrabold uppercase tracking-widest px-4 py-1.5 rounded-full mb-5">
            {tr.badge}
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-5">
            {tr.heroTitle1}<br />
            <span className="text-[var(--brand-accent)]">{tr.heroTitle2}</span>
          </h1>
          <p className="text-white/70 text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
            {tr.heroSub}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#request-bid"
              className="inline-block bg-[var(--brand-accent)] hover:bg-[#d45f57] text-white font-extrabold text-sm uppercase tracking-widest px-8 py-4 rounded-full transition-colors"
            >
              {tr.heroBtn}
            </a>
          </div>
        </div>
      </section>

      {/* ── Industries ─────────────────────────────────────────────────────── */}
      <section className="px-4 py-16 bg-white">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--brand-primary)] mb-3">{tr.industriesTitle}</h2>
            <p className="text-gray-500 max-w-xl mx-auto text-sm leading-relaxed">
              {tr.industriesSub}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {tr.industries.map((ind) => (
              <div
                key={ind.title}
                className="bg-[#f7f8fb] rounded-2xl p-5 border border-gray-100 hover:border-[var(--brand-accent)]/30 hover:shadow-sm transition-all"
              >
                <div className="text-3xl mb-3">{ind.icon}</div>
                <h3 className="font-extrabold text-[var(--brand-primary)] text-sm mb-1.5">{ind.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{ind.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────────── */}
      <section className="px-4 py-16 bg-[#f7f8fb]">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--brand-primary)] mb-3">{tr.howTitle}</h2>
            <p className="text-gray-500 text-sm">{tr.howSub}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {tr.steps.map((step) => (
              <div key={step.num} className="text-center">
                <div className="w-14 h-14 rounded-full bg-[var(--brand-primary)] text-white font-extrabold text-xl flex items-center justify-center mx-auto mb-4">
                  {step.num}
                </div>
                <h3 className="font-extrabold text-[var(--brand-primary)] mb-2">{step.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Benefits ────────────────────────────────────────────────────────── */}
      <section className="px-4 py-16 bg-white">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--brand-primary)] mb-3">{tr.benefitsTitle}</h2>
            <p className="text-gray-500 text-sm">{tr.benefitsSub}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {tr.benefits.map((b) => (
              <div key={b.title} className="flex gap-4 p-5 rounded-2xl bg-[#f7f8fb] border border-gray-100">
                <div className="text-2xl shrink-0 mt-0.5">{b.icon}</div>
                <div>
                  <h3 className="font-extrabold text-[var(--brand-primary)] text-sm mb-1">{b.title}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Request a Bid Form ───────────────────────────────────────────────── */}
      <section id="request-bid" className="bg-[var(--brand-primary)] px-4 py-16">
        <div className="mx-auto max-w-2xl">
          <div className="text-center mb-8">
            <div className="text-4xl mb-4">🧺</div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
              {tr.formTitle}
            </h2>
            <p className="text-white/60 text-sm leading-relaxed">
              {tr.formSub}
            </p>
          </div>
          <CommercialForm />
        </div>
      </section>

      {/* ── Footer note ─────────────────────────────────────────────────────── */}
      <section className="bg-[#f7f8fb] px-4 py-8 text-center border-t border-gray-100">
        <p className="text-gray-400 text-xs">
          WashFold Orlando · Commercial Laundry Pickup &amp; Delivery ·{" "}
          <Link href={lang === "es" ? "/?lang=es" : "/"} className="text-[var(--brand-accent)] hover:underline">{tr.footerBack}</Link>
        </p>
      </section>

    </main>
  )
}
