"use client"

import { useLang } from "./lang-provider"

export function LangToggle({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const { locale, setLocale } = useLang()

  const dark = variant === "dark"

  return (
    <div className={`flex items-center gap-0.5 rounded-full border p-0.5 text-[11px] font-bold ${dark ? "border-white/20" : "border-gray-200"}`}>
      <button
        onClick={() => setLocale("en")}
        className={`px-2.5 py-1 rounded-full transition-colors ${
          locale === "en"
            ? dark ? "bg-white text-[#0D2240]" : "bg-[#0D2240] text-white"
            : dark ? "text-white/60 hover:text-white" : "text-gray-400 hover:text-[#0D2240]"
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLocale("es")}
        className={`px-2.5 py-1 rounded-full transition-colors ${
          locale === "es"
            ? dark ? "bg-white text-[#0D2240]" : "bg-[#0D2240] text-white"
            : dark ? "text-white/60 hover:text-white" : "text-gray-400 hover:text-[#0D2240]"
        }`}
      >
        ES
      </button>
    </div>
  )
}
