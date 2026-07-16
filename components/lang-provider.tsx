"use client"

import { createContext, useContext, useEffect, useState, useTransition } from "react"
import type { Locale } from "@/lib/i18n"
import { getTranslations } from "@/lib/i18n"
import { setSiteLangCookie } from "@/app/actions/site-lang"
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
  const [, startTransition] = useTransition()

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

    // Keep the URL in sync too, purely for shareable links / SEO crawlers —
    // this alone does NOT make server-rendered pages (e.g. /commercial,
    // /service-areas) re-render, since a raw history.replaceState() is
    // invisible to Next.js.
    const url = new URL(window.location.href)
    if (l === "en") {
      url.searchParams.delete("lang")
    } else {
      url.searchParams.set("lang", l)
    }
    window.history.replaceState({}, "", url.toString())

    // The actual mechanism: set a cookie server-side and revalidate the
    // whole route tree (mirrors app/actions/admin-lang.ts, which already
    // works for the admin panel). Server Components — including RootLayout,
    // which can read cookies but NOT searchParams — pick up the new
    // language on the resulting re-render, without a client-side navigation
    // that would otherwise reset this component's own state.
    startTransition(() => {
      setSiteLangCookie(l)
    })
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
