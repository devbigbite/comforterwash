"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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
  const router = useRouter()

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

    // Server components (e.g. /commercial, /service-areas) read the "lang"
    // query param directly and pick their own translations independent of
    // this client context. A plain history.replaceState() only updates the
    // URL bar — it doesn't ask Next.js to re-render those server components,
    // so their body content silently stays in whatever language the page
    // first loaded with. router.replace() triggers a real (soft) navigation
    // so those pages re-render with the new "lang" param too.
    const url = new URL(window.location.href)
    if (l === "en") {
      url.searchParams.delete("lang")
    } else {
      url.searchParams.set("lang", l)
    }
    router.replace(url.pathname + url.search, { scroll: false })
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
