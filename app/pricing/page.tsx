import { getActivePlans } from "@/app/actions/subscription-plans"
import { getActiveRoutes } from "@/app/actions/routes"
import PricingClient from "./pricing-client"
import Link from "next/link"

export const metadata = {
  title: "Monthly Plans — WashFold Orlando",
  description: "Choose a monthly laundry plan. Flat monthly fee, lbs included, free pickup & delivery.",
}

export default async function PricingPage() {
  const [plans, routes] = await Promise.all([getActivePlans(), getActiveRoutes()])

  return (
    <main className="min-h-screen bg-[#f7f8fb]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[#0D2240] font-extrabold text-lg">
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="24" r="24" fill="#0D2240" />
              <path d="M8 24 Q11 19 14 24 Q17 29 20 24 Q23 19 26 24 Q29 29 32 24 Q35 19 38 24"
                stroke="#E8726A" strokeWidth="3" strokeLinecap="round" fill="none" />
            </svg>
            Wash<span className="text-[#E8726A]">Fold</span>
          </Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-[#0D2240] transition-colors">
            ← All Services
          </Link>
        </div>
      </header>

      <PricingClient plans={plans} routes={routes} />
    </main>
  )
}
