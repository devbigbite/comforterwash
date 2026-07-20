"use client"

import { useState } from "react"
import { checkZipServiceable } from "@/app/actions/settings"
import { useLang } from "@/components/lang-provider"

export function ZipChecker() {
  const [zip, setZip] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "yes" | "no">("idle")
  const { translations: tr } = useLang()
  const t = tr.zip

  async function checkZip() {
    const cleaned = zip.trim()
    if (cleaned.length < 5) return
    setStatus("loading")
    const serviceable = await checkZipServiceable(cleaned)
    setStatus(serviceable ? "yes" : "no")
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full max-w-sm gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          placeholder={t.placeholder}
          value={zip}
          onChange={(e) => {
            setZip(e.target.value.replace(/\D/g, ""))
            setStatus("idle")
          }}
          onKeyDown={(e) => e.key === "Enter" && checkZip()}
          className="flex-1 rounded-xl border border-[#d0d8e8] bg-white px-4 py-3 text-sm text-[#0D2240] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#E8726A]/40"
        />
        <button
          onClick={checkZip}
          disabled={zip.length < 5 || status === "loading"}
          className="rounded-xl bg-[#E8726A] px-5 py-3 text-sm font-bold text-white hover:bg-[#d45f57] transition-colors disabled:opacity-50"
        >
          {status === "loading" ? "..." : t.check}
        </button>
      </div>

      {status === "yes" && (
        <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 font-medium">
          <span className="text-green-500 text-base">✓</span>
          {t.available}
        </div>
      )}
      {status === "no" && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 font-medium">
          <span className="text-amber-500 text-base">○</span>
          {t.unavailable}
        </div>
      )}
    </div>
  )
}
