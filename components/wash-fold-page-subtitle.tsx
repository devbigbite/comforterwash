"use client"

import { useLang } from "@/components/lang-provider"

const STRINGS = {
  en: { once: "one-time", sub: "with subscription", min: "lb minimum" },
  es: { once: "una vez",  sub: "con suscripción",   min: "lb mínimo"  },
}

interface Props {
  oneTimeCents: number
  subCents: number
  minLbs: number
}

export function WashFoldPageSubtitle({ oneTimeCents, subCents, minLbs }: Props) {
  const { locale } = useLang()
  const s = STRINGS[locale] ?? STRINGS.en
  return (
    <p className="text-white/60 text-sm">
      ${(oneTimeCents / 100).toFixed(2)}/lb {s.once}
      {" · "}${(subCents / 100).toFixed(2)}/lb {s.sub}
      {" · "}{minLbs} {s.min}
    </p>
  )
}
