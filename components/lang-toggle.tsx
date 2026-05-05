"use client"

import { useLang } from "./lang-provider"

export function LangToggle() {
  const { locale, setLocale } = useLang()

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-white/20 p-0.5 text-[11px] font-bold">
      <button
        onClick={() => setLocale("en")}
        className={`px-2.5 py-1 rounded-full transition-colors ${
          locale === "en"
            ? "bg-white text-[#0D2240]"
            : "text-white/60 hover:text-white"
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLocale("es")}
        className={`px-2.5 py-1 rounded-full transition-colors ${
          locale === "es"
            ? "bg-white text-[#0D2240]"
            : "text-white/60 hover:text-white"
        }`}
      >
        ES
      </button>
    </div>
  )
}
