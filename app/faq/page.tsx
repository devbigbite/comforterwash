import Link from "next/link"
import { getFaqItems, type FaqItem, type FaqCategory } from "@/app/actions/faq"

export const metadata = { title: "FAQ — ComforterWash Orlando" }
export const revalidate = 60

const CATEGORIES: { key: FaqCategory; label: string; description: string; icon: string }[] = [
  {
    key: "general",
    label: "General",
    description: "How it works, service areas, pickup & delivery, contact",
    icon: "💬",
  },
  {
    key: "comforter_wash",
    label: "Comforter Washing",
    description: "Sizes, pricing, care process, turnaround time",
    icon: "🛏️",
  },
  {
    key: "wash_fold",
    label: "Wash & Fold",
    description: "Per-pound pricing, detergent, stains, subscriptions",
    icon: "👕",
  },
]

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
    // linkify email
    const parts = block.split("clean@washfoldorlando.com")
    if (parts.length > 1) {
      return (
        <p key={i} className="text-gray-600 text-sm leading-relaxed mt-2">
          {parts.map((part, j) => (
            <span key={j}>
              {part}
              {j < parts.length - 1 && (
                <a href="mailto:clean@washfoldorlando.com" className="text-[#E8726A] underline">
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
        <span className="font-semibold text-[#0D2240] text-sm pr-4 group-open:text-[#E8726A] transition-colors">
          {item.question}
        </span>
        <span className="shrink-0 w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 group-open:text-[#E8726A] group-open:border-[#E8726A] group-open:rotate-45 transition-all text-sm">
          +
        </span>
      </summary>
      <div className="pb-4 px-1">
        {renderAnswer(item.answer)}
      </div>
    </details>
  )
}

export default async function FaqPage() {
  const allItems = await getFaqItems()
  const activeItems = allItems.filter(i => i.active)

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-[#0D2240] px-4 py-16 text-center">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">
          Frequently Asked Questions
        </h1>
        <p className="text-white/50 text-sm mt-3 max-w-md mx-auto">
          Everything you need to know about our laundry pickup &amp; delivery service in Orlando.
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
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-[#E8726A] hover:shadow-md transition-all group"
              >
                <div className="text-2xl mb-2">{cat.icon}</div>
                <p className="font-extrabold text-[#0D2240] text-sm group-hover:text-[#E8726A] transition-colors">
                  {cat.label}
                </p>
                <p className="text-xs text-gray-400 mt-1 leading-snug">{cat.description}</p>
                <p className="text-xs text-gray-300 mt-2">{count} question{count !== 1 ? "s" : ""}</p>
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
                    <h2 className="text-xl font-extrabold text-[#0D2240]">{cat.label}</h2>
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
        <div className="bg-[#0D2240] rounded-2xl p-8 text-center mb-16">
          <p className="text-white font-extrabold text-lg">Still have questions?</p>
          <p className="text-white/60 text-sm mt-2 mb-4">
            We&apos;re happy to help. Reach out and we&apos;ll get back to you quickly.
          </p>
          <a
            href="mailto:clean@washfoldorlando.com"
            className="inline-block bg-[#E8726A] text-white font-bold text-sm px-6 py-3 rounded-full hover:bg-[#d45f57] transition-colors"
          >
            Email Us →
          </a>
        </div>

        {/* Footer nav */}
        <div className="border-t border-gray-100 py-6 flex gap-4 text-xs text-gray-400">
          <Link href="/" className="hover:text-[#E8726A] transition-colors">← Back to Home</Link>
          <Link href="/terms" className="hover:text-[#E8726A] transition-colors">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-[#E8726A] transition-colors">Privacy Policy</Link>
        </div>
      </div>
    </main>
  )
}
