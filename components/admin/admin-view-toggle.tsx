"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { setAdminViewMode, type AdminViewMode } from "@/app/actions/branding"

export function AdminViewToggle({ mode, lang }: { mode: AdminViewMode; lang: "en" | "es" }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [current, setCurrent] = useState(mode)

  function switchTo(next: AdminViewMode) {
    if (next === current) return
    setCurrent(next)
    startTransition(async () => {
      await setAdminViewMode(next)
      router.refresh()
    })
  }

  const label = {
    simple: lang === "es" ? "Simple" : "Simple",
    advanced: lang === "es" ? "Avanzado" : "Advanced",
  }

  return (
    <div className="flex items-center bg-white/10 rounded-full p-0.5 text-xs font-semibold">
      {(["simple", "advanced"] as const).map((m) => (
        <button
          key={m}
          type="button"
          disabled={pending}
          onClick={() => switchTo(m)}
          className={`px-3 py-1 rounded-full transition-colors whitespace-nowrap ${
            current === m ? "bg-white text-[#0D2240]" : "text-white/50 hover:text-white"
          }`}
        >
          {label[m]}
        </button>
      ))}
    </div>
  )
}
