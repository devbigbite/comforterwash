import Link from "next/link"
import { getLegalPage, type LegalSection } from "@/app/actions/legal"

export const metadata = { title: "Terms of Service — ComforterWash Orlando" }
export const revalidate = 60 // Re-fetch from DB at most every 60 seconds

// ── Content renderer ─────────────────────────────────────────────────────────

function renderBlocks(content: string, isWarning: boolean) {
  const textClass = isWarning
    ? "text-sm text-amber-700 leading-relaxed"
    : "text-sm text-gray-600 leading-relaxed"
  const listClass = isWarning
    ? "text-sm text-amber-700 space-y-1.5 list-disc list-inside"
    : "text-sm text-gray-600 space-y-1.5 list-disc list-inside"

  const blocks = content.split("\n\n")
  return blocks.map((block, i) => {
    const lines = block.split("\n").filter((l) => l.trim())
    if (lines.length > 0 && lines.every((l) => l.startsWith("- "))) {
      return (
        <ul key={i} className={listClass}>
          {lines.map((l, j) => (
            <li key={j}>{l.slice(2)}</li>
          ))}
        </ul>
      )
    }
    // linkify email address
    const parts = block.split("hello@comforterwash.com")
    if (parts.length > 1) {
      return (
        <p key={i} className={textClass}>
          {parts.map((part, j) => (
            <span key={j}>
              {part}
              {j < parts.length - 1 && (
                <a href="mailto:hello@comforterwash.com" className="text-[#E8726A] underline">
                  hello@comforterwash.com
                </a>
              )}
            </span>
          ))}
        </p>
      )
    }
    return <p key={i} className={textClass}>{block}</p>
  })
}

function Section({ section }: { section: LegalSection }) {
  const isWarning = section.style === "warning"
  if (isWarning) {
    return (
      <section className="space-y-3 rounded-xl border border-amber-100 bg-amber-50 p-5">
        <h2 className="text-lg font-extrabold text-amber-800">{section.title}</h2>
        {renderBlocks(section.content, true)}
      </section>
    )
  }
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-extrabold">{section.title}</h2>
      {renderBlocks(section.content, false)}
    </section>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function TermsPage() {
  const sections = await getLegalPage("terms")

  return (
    <main className="min-h-screen bg-white">
      <div className="bg-[#0D2240] px-4 py-12 text-center">
        <h1 className="text-3xl font-extrabold text-white">Terms of Service</h1>
        <p className="text-white/50 text-sm mt-2">Last updated: May 2026</p>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-14 space-y-10 text-[#0D2240]">
        {sections.map((s) => (
          <Section key={s.id} section={s} />
        ))}

        <div className="border-t border-gray-100 pt-6 flex gap-4 text-xs text-gray-400">
          <Link href="/" className="hover:text-[#E8726A] transition-colors">← Back to Home</Link>
          <Link href="/privacy" className="hover:text-[#E8726A] transition-colors">Privacy Policy</Link>
        </div>
      </div>
    </main>
  )
}
