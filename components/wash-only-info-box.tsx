"use client"

import { useLang } from "@/components/lang-provider"

const STRINGS = {
  en: {
    title: "What is Wash Only?",
    body: "Your clothes are washed and dried using your preferred detergent, then returned clean in the bag — unfolded.",
  },
  es: {
    title: "¿Qué es Wash Only?",
    body: "Tu ropa se lava y se seca con el detergente de tu preferencia, y se devuelve limpia en la bolsa — sin doblar.",
  },
}

export function WashOnlyInfoBox() {
  const { locale } = useLang()
  const s = STRINGS[locale] ?? STRINGS.en
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 text-sm text-blue-700">
      <strong>{s.title}</strong> {s.body}
    </div>
  )
}
