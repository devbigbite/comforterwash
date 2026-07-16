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
    // this client context. Update the URL first so it's consistent...
    const url = new URL(window.location.href)
    if (l === "en") {
      url.searchParams.delete("lang")
    } else {
      url.searchParams.set("lang", l)
    }
    window.history.replaceState({}, "", url.toString())

    // ...then ask Next.js to re-fetch this route's Server Component payload
    // (picking up the new "lang" param) via router.refresh(). Unlike
    // router.replace()/push(), refresh() does NOT perform a client-side
    // navigation — it re-renders Server Components in place while leaving
    // Client Component state (like this locale) untouched. router.replace()
    // was tried here first, but it caused RootLayout to re-run with its own
    // (unsupported) searchParams read, which always resolves to "en" and
    // was snapping the language straight back to English on every toggle.
    router.refresh()
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
