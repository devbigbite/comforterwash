"use client"

import { createContext, useContext, useEffect, useState } from "react"
import type { Locale } from "@/lib/i18n"
import { getTranslations } from "@/lib/i18n"
import type { TranslationKeys } from "@/lib/translations/en"

interface LangContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  translations: TranslationKeys
}

const LangContext = createContext<LangContextValue>({
  locale: "en",
  setLocale: () => {},
  translations: getTranslations("en") as TranslationKeys,
})

export function LangProvider({
  children,
  initialLocale = "en",
}: {
  children: React.ReactNode
  initialLocale?: Locale
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  useEffect(() => {
    // Persist preference
    try {
      const saved = localStorage.getItem("wf-locale") as Locale | null
      if (saved === "en" || saved === "es") setLocaleState(saved)
    } catch {}
  }, [])

  const setLocale = (l: Locale) => {
    setLocaleState(l)
    try { localStorage.setItem("wf-locale", l) } catch {}
    // Update URL param without full reload for SEO crawlers
    const url = new URL(window.location.href)
    if (l === "en") {
      url.searchParams.delete("lang")
    } else {
      url.searchParams.set("lang", l)
    }
    window.history.replaceState({}, "", url.toString())
  }

  return (
    <LangContext.Provider
      value={{
        locale,
        setLocale,
        translations: getTranslations(locale) as TranslationKeys,
      }}
    >
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
