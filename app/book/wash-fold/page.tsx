import { WashFoldForm } from "@/components/wash-fold-form"
import { LangToggle } from "@/components/lang-toggle"
import { BookingPageTitle } from "@/components/booking-page-title"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getServicesConfig } from "@/app/actions/settings"

export const metadata = {
  title: "Book Wash & Fold — WashFold Orlando",
  description: "Clothes washed, dried, and folded with free pickup & delivery. $2.40/lb, $20 minimum.",
}

export default async function WashFoldPage() {
  const services = await getServicesConfig()
  if (!services.wash_fold) redirect("/")
  return (
    <main className="min-h-screen bg-[#f7f8fb]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-2xl px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[#0D2240] font-extrabold text-lg">
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="24" r="24" fill="#0D2240" />
              <path d="M8 24 Q11 19 14 24 Q17 29 20 24 Q23 19 26 24 Q29 29 32 24 Q35 19 38 24"
                stroke="#E8726A" strokeWidth="3" strokeLinecap="round" fill="none" />
            </svg>
            Wash<span className="text-[#E8726A]">Fold</span>
          </Link>
          <div className="flex items-center gap-4">
            <LangToggle variant="light" />
            <Link href="/" className="text-sm text-gray-400 hover:text-[#0D2240] transition-colors">
              ← All Services
            </Link>
          </div>
        </div>
      </header>

      {/* Service badge */}
      <div className="bg-[#0D2240] py-8 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 mb-3">
          <span className="text-2xl">👕</span>
          <span className="text-white font-bold text-sm">Wash &amp; Fold</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-1"><BookingPageTitle /></h1>
        <p className="text-white/60 text-sm">$2.40/lb one-time · $2.15/lb with subscription · 20 lb minimum</p>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-10 overflow-hidden">
        <WashFoldForm />
      </div>
    </main>
  )
}
