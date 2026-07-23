import { BookingForm } from "@/components/booking-form"
import { LangToggle } from "@/components/lang-toggle"
import { BookingPageTitle } from "@/components/booking-page-title"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getServicesConfig } from "@/app/actions/settings"
import { getBranding } from "@/lib/location"

export async function generateMetadata() {
  const branding = await getBranding()
  return {
    title: `Book Comforter Wash — ${branding.business_name || "WashFoldClean"}`,
    description: "Schedule pickup and delivery for your comforter. Fully water washed, from $35.",
  }
}

export default async function ComforterWashPage() {
  const services = await getServicesConfig()
  if (!services.comforter_wash) redirect("/")
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
          <span className="text-2xl">🛏️</span>
          <span className="text-white font-bold text-sm">Comforter Wash</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-1"><BookingPageTitle /></h1>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-10">
        <BookingForm />
      </div>
    </main>
  )
}
