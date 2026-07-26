"use client"

import { useLang } from "@/components/lang-provider"

const STRINGS = {
  en: { min: "lb minimum", returned: "Returned clean, unfolded" },
  es: { min: "lb mínimo",  returned: "Se devuelve limpia, sin doblar" },
}

interface Props {
  priceCents: number
  minLbs: number
}

export function WashOnlyPageSubtitle({ priceCents, minLbs }: Props) {
  const { locale } = useLang()
  const s = STRINGS[locale] ?? STRINGS.en
  return (
    <p className="text-white/60 text-sm">
      ${(priceCents / 100).toFixed(2)}/lb
      {" · "}{minLbs} {s.min}
      {" · "}{s.returned}
    </p>
  )
}
