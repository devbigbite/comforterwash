"use client"

import { useTransition } from "react"
import { setAdminLangCookie } from "@/app/actions/admin-lang"

export function AdminLangToggle({ lang }: { lang: "en" | "es" }) {
  const [, startTransition] = useTransition()

  function toggle() {
    const next = lang === "en" ? "es" : "en"
    startTransition(async () => {
      await setAdminLangCookie(next)
    })
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
