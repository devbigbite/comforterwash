import { getActivePlans } from "@/app/actions/subscription-plans"
import { getActiveRoutes } from "@/app/actions/routes"
import { getServiceOptions } from "@/app/actions/service-options"
import { getMonthlyPlanEnabled } from "@/app/actions/settings"
import PricingClient from "./pricing-client"
import Link from "next/link"

export const metadata = {
  title: "Monthly Plans — WashFold Orlando",
  description: "Choose a monthly laundry plan. Flat monthly fee, lbs included, free pickup & delivery.",
}

export default async function PricingPage() {
  const [plans, routes, detergents, planEnabled] = await Promise.all([
    getActivePlans(),
    getActiveRoutes(),
    getServiceOptions("detergent"),
    getMonthlyPlanEnabled(),
  ])

  return (
    <main className="min-h-screen bg-[#f7f8fb]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[var(--brand-primary)] font-extrabold text-lg">
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="24" r="24" fill="var(--brand-primary)" />
              <path d="M8 24 Q11 19 14 24 Q17 29 20 24 Q23 19 26 24 Q29 29 32 24 Q35 19 38 24"
                stroke="var(--brand-accent)" strokeWidth="3" strokeLinecap="round" fill="none" />
            </svg>
            Wash<span className="text-[var(--brand-accent)]">Fold</span>
          </Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-[var(--brand-primary)] transition-colors">
            ← All Services
          </Link>
        </div>
      </header>

      {!planEnabled ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <div className="text-5xl mb-4">🚧</div>
          <h2 className="text-2xl font-extrabold text-[var(--brand-primary)] mb-2">Monthly plans are paused</h2>
          <p className="text-gray-500 max-w-sm mb-6">We&apos;re not accepting new monthly plan subscribers right now. Check back soon or book a one-time or recurring pickup instead.</p>
          <Link href="/" className="bg-[var(--brand-primary)] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#1a3a5c] transition-colors">
            Book a pickup
          </Link>
        </div>
      ) : (
        <PricingClient plans={plans} routes={routes} detergents={detergents} />
      )}
    </main>
  )
}
