import Link from "next/link"
import { getFaqItems, type FaqItem, type FaqCategory } from "@/app/actions/faq"
import { getSiteLangCookie } from "@/app/actions/site-lang"
import en from "@/lib/translations/en"
import es from "@/lib/translations/es"

export const metadata = { title: "FAQ — WashFold Orlando" }
// force-dynamic instead of a plain revalidate window: this page reads the
// wf_locale cookie (via getSiteLangCookie()) to follow the EN/ES toggle,
// and an indirect cookies() call through an imported helper doesn't always
// get picked up by Next's static-analysis opt-in to dynamic rendering
// (see app/commercial/page.tsx, which hit this exact bug).
export const dynamic = "force-dynamic"

function getCategories(t: typeof en.faqPage) {
  return [
    {
      key: "general" as FaqCategory,
      label: t.catGeneral,
      description: t.catGeneralDesc,
      icon: "💬",
    },
    {
      key: "comforter_wash" as FaqCategory,
      label: t.catComforter,
      description: t.catComforterDesc,
      icon: "🛏️",
    },
    {
      key: "wash_fold" as FaqCategory,
      label: t.catWashFold,
      description: t.catWashFoldDesc,
      icon: "👕",
    },
  ]
}

function renderAnswer(answer: string) {
  const blocks = answer.split("\n\n")
  return blocks.map((block, i) => {
    const lines = block.split("\n").filter(l => l.trim())
    if (lines.length > 0 && lines.every(l => l.startsWith("- "))) {
      return (
        <ul key={i} className="list-disc list-inside space-y-1 text-gray-600 text-sm mt-2">
          {lines.map((l, j) => <li key={j}>{l.slice(2)}</li>)}
        </ul>
      )
    }
    const parts = block.split("clean@washfoldorlando.com")
    if (parts.length > 1) {
      return (
        <p key={i} className="text-gray-600 text-sm leading-relaxed mt-2">
          {parts.map((part, j) => (
            <span key={j}>
              {part}
              {j < parts.length - 1 && (
                <a href="mailto:clean@washfoldorlando.com" className="text-[var(--brand-accent)] underline">
                  clean@washfoldorlando.com
                </a>
              )}
            </span>
          ))}
        </p>
      )
    }
    return <p key={i} className="text-gray-600 text-sm leading-relaxed mt-2">{block}</p>
  })
}

function AccordionItem({ item }: { item: FaqItem }) {
  return (
    <details className="group border-b border-gray-100 last:border-0">
      <summary className="flex items-center justify-between py-4 px-1 cursor-pointer list-none select-none">
        <span className="font-semibold text-[var(--brand-primary)] text-sm pr-4 group-open:text-[var(--brand-accent)] transition-colors">
          {item.question}
        </span>
        <span className="shrink-0 w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 group-open:text-[var(--brand-accent)] group-open:border-[var(--brand-accent)] group-open:rotate-45 transition-all text-sm">
          +
        </span>
      </summary>
      <div className="pb-4 px-1">
        {renderAnswer(item.answer)}
      </div>
    </details>
  )
}

export default async function FaqPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>
}) {
  const { lang: langParam } = await searchParams
  const lang = langParam ?? (await getSiteLangCookie())
  const tr = lang === "es" ? es.faqPage : en.faqPage

  const allItems = await getFaqItems(lang)
  const activeItems = allItems.filter(i => i.active)
  const CATEGORIES = getCategories(tr)

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-[var(--brand-primary)] px-4 py-16 text-center">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">
          {tr.title}
        </h1>
        <p className="text-white/50 text-sm mt-3 max-w-md mx-auto">
          {tr.subtitle}
        </p>
      </div>

      {/* Category cards */}
      <div className="max-w-3xl mx-auto px-4 -mt-6">
        <div className="grid grid-cols-3 gap-3 mb-12">
          {CATEGORIES.map(cat => {
            const count = activeItems.filter(i => i.category === cat.key).length
            return (
              <a
                key={cat.key}
                href={`#${cat.key}`}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-[var(--brand-accent)] hover:shadow-md transition-all group"
              >
                <div className="text-2xl mb-2">{cat.icon}</div>
                <p className="font-extrabold text-[var(--brand-primary)] text-sm group-hover:text-[var(--brand-accent)] transition-colors">
                  {cat.label}
                </p>
                <p className="text-xs text-gray-400 mt-1 leading-snug">{cat.description}</p>
                <p className="text-xs text-gray-300 mt-2">
                  {count} {count !== 1 ? tr.questionsCount : tr.questionCount}
                </p>
              </a>
            )
          })}
        </div>

        {/* FAQ sections */}
        <div className="space-y-12 pb-20">
          {CATEGORIES.map(cat => {
            const catItems = activeItems.filter(i => i.category === cat.key)
            if (catItems.length === 0) return null
            return (
              <section key={cat.key} id={cat.key} className="scroll-mt-8">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{cat.icon}</span>
                  <div>
                    <h2 className="text-xl font-extrabold text-[var(--brand-primary)]">{cat.label}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">{cat.description}</p>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 divide-y divide-gray-100">
                  {catItems.map(item => (
                    <AccordionItem key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        {/* Still have questions */}
        <div className="bg-[var(--brand-primary)] rounded-2xl p-8 text-center mb-16">
          <p className="text-white font-extrabold text-lg">{tr.stillHave}</p>
          <p className="text-white/60 text-sm mt-2 mb-4">{tr.stillHaveSub}</p>
          <a
            href="mailto:clean@washfoldorlando.com"
            className="inline-block bg-[var(--brand-accent)] text-white font-bold text-sm px-6 py-3 rounded-full hover:bg-[#d45f57] transition-colors"
          >
            {tr.emailUs}
          </a>
        </div>

        {/* Footer nav */}
        <div className="border-t border-gray-100 py-6 flex gap-4 text-xs text-gray-400">
          <Link href={lang === "es" ? "/?lang=es" : "/"} className="hover:text-[var(--brand-accent)] transition-colors">{tr.backHome}</Link>
          <Link href="/terms" className="hover:text-[var(--brand-accent)] transition-colors">{tr.terms}</Link>
          <Link href="/privacy" className="hover:text-[var(--brand-accent)] transition-colors">{tr.privacy}</Link>
        </div>
      </div>
    </main>
  )
}
