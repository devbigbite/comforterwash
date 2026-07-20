import { getPitchTemplate, incrementTemplateViewCount } from "@/app/actions/outreach"
import { notFound } from "next/navigation"
import Link from "next/link"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const t = await getPitchTemplate(slug)
  if (!t) return { title: "Proposal" }
  return {
    title: `${t.title} — WashFold Orlando`,
    description: t.tagline ?? undefined,
  }
}

export default async function PublicPitchPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const t = await getPitchTemplate(slug)
  if (!t) notFound()

  // Increment view count (fire and forget)
  try {
    await incrementTemplateViewCount(t.id)
  } catch {}

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 text-white">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center text-xl">
              🫧
            </div>
            <div>
              <div className="text-sm font-medium text-indigo-200">WashFold Orlando</div>
              <div className="text-xs text-indigo-300">Commercial Laundry Services</div>
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
            {t.cover_headline ?? t.title}
          </h1>
          {t.tagline && (
            <p className="text-indigo-200 text-lg">{t.tagline}</p>
          )}
        </div>
      </div>

      {/* Intro */}
      {t.intro_paragraph && (
        <div className="max-w-3xl mx-auto px-6 py-12">
          <p className="text-slate-700 text-lg leading-relaxed">{t.intro_paragraph}</p>
        </div>
      )}

      {/* Value Props */}
      {t.value_props && t.value_props.length > 0 && (
        <div className="bg-slate-50 py-12">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-xl font-bold text-slate-900 mb-8">Why WashFold Orlando?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {t.value_props.map((v, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 flex gap-4">
                  <div className="text-2xl flex-shrink-0">{v.icon}</div>
                  <div>
                    <div className="font-semibold text-slate-800 mb-1">{v.title}</div>
                    <div className="text-slate-600 text-sm leading-relaxed">{v.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Services */}
      {t.services_offered && t.services_offered.length > 0 && (
        <div className="max-w-3xl mx-auto px-6 py-12">
          <h2 className="text-xl font-bold text-slate-900 mb-8">Services Included</h2>
          <div className="space-y-4">
            {t.services_offered.map((s, i) => (
              <div key={i} className="flex items-start gap-4 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-indigo-700 text-xs font-bold">{i + 1}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-800">{s.name}</div>
                    {s.price_note && (
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex-shrink-0">
                        {s.price_note}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 text-sm mt-1">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pricing */}
      {t.pricing_table && t.pricing_table.length > 0 && (
        <div className="bg-slate-50 py-12">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-xl font-bold text-slate-900 mb-8">Pricing Overview</h2>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-indigo-50 border-b border-slate-200">
                    <th className="px-5 py-3 text-left font-semibold text-slate-700">Service</th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-700">Unit</th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-700">Rate</th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-700 hidden md:table-cell">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {t.pricing_table.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-3.5 font-medium text-slate-800">{r.item}</td>
                      <td className="px-5 py-3.5 text-slate-500">{r.unit}</td>
                      <td className="px-5 py-3.5 font-semibold text-indigo-700">{r.price}</td>
                      <td className="px-5 py-3.5 text-slate-400 text-xs hidden md:table-cell">{r.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400 mt-3">* All rates subject to final agreement based on your specific volume and schedule.</p>
          </div>
        </div>
      )}

      {/* Closing */}
      {t.closing_statement && (
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Ready to Get Started?</h2>
            <p className="text-slate-700 leading-relaxed mb-6">{t.closing_statement}</p>
            <div className="flex flex-wrap gap-3">
              <a
                href="tel:+14073002999"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors text-sm"
              >
                📞 Call Us
              </a>
              <a
                href="mailto:hello@washfoldorlando.com"
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-medium rounded-lg transition-colors text-sm"
              >
                ✉ Email Us
              </a>
              <Link
                href={`/pitch/${t.slug}/proposal.pdf`}
                target="_blank"
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium rounded-lg transition-colors text-sm"
              >
                ↓ Download Proposal
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="text-sm font-semibold text-slate-700">WashFold Orlando · SaleCalle LLC</div>
          <div className="text-xs text-slate-400 mt-1">10524 Moss Park Rd, Ste 204177 · Orlando, FL 32832 · Confidential</div>
        </div>
      </footer>
    </div>
  )
}
