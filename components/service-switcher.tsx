"use client"

import { useState } from "react"
import { WashFoldForm } from "@/components/wash-fold-form"
import { WashOnlyForm } from "@/components/wash-only-form"
import { WashOnlyInfoBox } from "@/components/wash-only-info-box"
import { BookingForm } from "@/components/booking-form"
import { BookingPageTitle } from "@/components/booking-page-title"
import { WashFoldPageSubtitle } from "@/components/wash-fold-page-subtitle"
import { WashOnlyPageSubtitle } from "@/components/wash-only-page-subtitle"
import type { PricingConfig, WashFoldBagConfig } from "@/app/actions/pricing"
import type { ServicesConfig } from "@/app/actions/settings"

export type ServiceKey = "wash_fold" | "comforter_wash" | "wash_only"

const SERVICE_META: Record<ServiceKey, { label: string; icon: string }> = {
  wash_fold:      { label: "Wash & Fold",    icon: "👕" },
  comforter_wash: { label: "Comforter Wash", icon: "🛏️" },
  wash_only:      { label: "Wash Only",      icon: "🧺" },
}

// Shared shell for all three booking flows. Picking a service in the
// picker (rendered inside the active form's step 1) swaps the hero
// badge/subtitle and the form below it, without a page navigation. Each of
// the three /book/* routes still exists (for bookmarks/links/SEO) and
// renders this with its own `defaultService`, so a customer landing on any
// one of them can switch to either of the other two in place.
export function ServiceSwitcher({
  defaultService,
  services,
  pricing,
  washFoldBagConfig,
}: {
  defaultService: ServiceKey
  services: ServicesConfig
  pricing: PricingConfig
  washFoldBagConfig?: WashFoldBagConfig
}) {
  const [service, setService] = useState<ServiceKey>(defaultService)
  const available = (Object.keys(SERVICE_META) as ServiceKey[]).filter(k => services[k])

  // Light-card styled service picker — rendered inline inside the active
  // form's step 1, not as a nav-like row in the dark hero. Tab-like
  // affordance (raised/bordered when selected) makes it read as "this is
  // the choice you're making", matching the ONE-TIME/RECURRING and
  // bag-count controls right below it.
  const picker = (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${available.length}, minmax(0, 1fr))` }}
    >
      {available.map(key => (
        <button
          key={key}
          type="button"
          onClick={() => setService(key)}
          className={`flex flex-col items-center justify-center gap-1 rounded-2xl border-2 px-3 py-3 text-xs sm:text-sm font-bold uppercase tracking-wide transition-all duration-200 ${
            service === key
              ? "border-[var(--brand-accent)] bg-[#fdf6f3] text-[var(--brand-primary)]"
              : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
          }`}
        >
          <span className="text-xl">{SERVICE_META[key].icon}</span>
          {SERVICE_META[key].label}
        </button>
      ))}
    </div>
  )

  return (
    <>
      {/* Dark hero band: badge, title, subtitle */}
      <div className="bg-[#0D2240] py-8 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 mb-3">
          <span className="text-2xl">{SERVICE_META[service].icon}</span>
          <span className="text-white font-bold text-sm">{SERVICE_META[service].label}</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-1"><BookingPageTitle /></h1>
        {service === "wash_fold" && (
          <WashFoldPageSubtitle
            oneTimeCents={pricing.washFoldOneTimeCents}
            subCents={pricing.washFoldSubCents}
            minLbs={pricing.washFoldMinLbs}
            bagMode={washFoldBagConfig?.mode}
            bagSizes={washFoldBagConfig?.bagSizes}
          />
        )}
        {service === "wash_only" && (
          <WashOnlyPageSubtitle priceCents={pricing.washOnlyCents} minLbs={pricing.washOnlyMinLbs} />
        )}
        {service === "comforter_wash" && (
          <p className="text-white/60 text-sm">Any size, one flat price · Fully water washed</p>
        )}

      </div>

      {/* Light body: form for the selected service. The service picker is
          passed in as `topSlot` and rendered by each form right after its
          own step-1 heading (e.g. "How would you like to book?") — sitting
          in the dark hero read as page navigation rather than a selection
          step, so it moved down into the card where the actual choice
          happens. */}
      <div className="mx-auto max-w-2xl px-4 py-10">
        {service === "wash_fold" && <WashFoldForm initialPricing={pricing} topSlot={picker} />}
        {service === "wash_only" && (
          <>
            <WashOnlyInfoBox />
            <WashOnlyForm initialPricing={pricing} topSlot={picker} />
          </>
        )}
        {service === "comforter_wash" && <BookingForm topSlot={picker} />}
      </div>
    </>
  )
}
