"use client"

import { useState, useEffect } from "react"

export const ADMIN_LANG_KEY = "washfold_admin_lang"

/** Read the admin lang preference from localStorage. Defaults to "en". */
export function getAdminLang(): "en" | "es" {
  if (typeof window === "undefined") return "en"
  return (localStorage.getItem(ADMIN_LANG_KEY) as "en" | "es") ?? "en"
}

/**
 * Small button that lives in the admin header — lets Spanish-speaking managers
 * toggle the admin UI language. Preference is persisted to localStorage.
 */
export function AdminLangToggle() {
  const [lang, setLang] = useState<"en" | "es">("en")

  useEffect(() => {
    setLang(getAdminLang())
  }, [])

  function toggle() {
    const next = lang === "en" ? "es" : "en"
    localStorage.setItem(ADMIN_LANG_KEY, next)
    setLang(next)
    // Reload so all static text on the page re-reads from the new preference
    window.location.reload()
  }

  return (
    <button
      onClick={toggle}
      title={lang === "en" ? "Switch to Spanish" : "Cambiar a Inglés"}
      className="text-white/40 hover:text-white text-xs font-bold px-3 py-1 rounded-full border border-white/20 hover:border-white/40 transition-colors whitespace-nowrap"
    >
      {lang === "en" ? "ES" : "EN"}
    </button>
  )
}
