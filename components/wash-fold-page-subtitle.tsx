"use client"

import { useLang } from "@/components/lang-provider"
import type { WashFoldPricingMode, BagSize } from "@/app/actions/pricing"

const STRINGS = {
  en: { once: "one-time", sub: "with subscription", min: "lb minimum", flatPerBag: "flat price per bag", chooseAtBooking: "choose weight or bag at booking" },
  es: { once: "una vez",  sub: "con suscripción",   min: "lb mínimo",  flatPerBag: "precio fijo por bolsa", chooseAtBooking: "elige peso o bolsa al reservar" },
}

interface Props {
  oneTimeCents: number
  subCents: number
  minLbs: number
  // When the tenant charges per bag (or offers both), the $/lb summary
  // below doesn't apply -- see app/actions/pricing.ts WashFoldBagConfig.
  bagMode?: WashFoldPricingMode
  bagSizes?: BagSize[]
}

export function WashFoldPageSubtitle({ oneTimeCents, subCents, minLbs, bagMode, bagSizes }: Props) {
  const { locale } = useLang()
  const s = STRINGS[locale] ?? STRINGS.en

  if (bagMode === "per_bag") {
    const activeSizes = (bagSizes ?? []).filter(b => b.enabled)
    if (activeSizes.length > 0) {
      const prices = activeSizes.map(b => b.priceCents).sort((a, b) => a - b)
      const low = prices[0], high = prices[prices.length - 1]
      const range = low === high ? `$${(low / 100).toFixed(2)}` : `$${(low / 100).toFixed(2)}–$${(high / 100).toFixed(2)}`
      return <p className="text-white/60 text-sm">{range} {s.flatPerBag}</p>
    }
    return <p className="text-white/60 text-sm">{s.flatPerBag}</p>
  }

  if (bagMode === "both") {
    return <p className="text-white/60 text-sm">{s.chooseAtBooking}</p>
  }

  return (
    <p className="text-white/60 text-sm">
      ${(oneTimeCents / 100).toFixed(2)}/lb {s.once}
      {" · "}${(subCents / 100).toFixed(2)}/lb {s.sub}
      {" · "}{minLbs} {s.min}
    </p>
  )
}
