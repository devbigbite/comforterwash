"use client"

import { useState, useEffect, useTransition } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { saveIcAgreement, getIcAgreements } from "@/app/actions/ic-agreements"
import Link from "next/link"

const ROLES = [
  { key: "driver",   label: "Driver",               icon: "🚐" },
  { key: "operator", label: "Washing Operator",      icon: "🧺" },
  { key: "combo",    label: "Operator / Driver",     icon: "🚐🧺" },
] as const

type Role = "driver" | "operator" | "combo"
type Lang = "en" | "es"

type Agreement = { id: string; role: Role; lang: Lang; body: string; version: number; updated_at: string; updated_by: string | null }

export default function AgreementsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const roleParam = (searchParams.get("role") ?? "driver") as Role
  const langParam = (searchParams.get("lang") ?? "en") as Lang

  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [loading, setLoading]       = useState(true)
  const [body, setBody]             = useState("")
  const [saved, setSaved]           = useState(false)
  const [error, setError]           = useState("")

  // Load all agreements once
  useEffect(() => {
    getIcAgreements().then((data) => {
      setAgreements(data)
      setLoading(false)
    })
  }, [])

  // When role/lang changes, sync textarea
  useEffect(() => {
    const match = agreements.find((a) => a.role === roleParam && a.lang === langParam)
    setBody(match?.body ?? "")
    setSaved(false)
    setError("")
  }, [roleParam, langParam, agreements])

  const current = agreements.find((a) => a.role === roleParam && a.lang === langParam)

  function nav(role: Role, lang: Lang) {
    router.push(`/admin/hiring/agreements?role=${role}&lang=${lang}`)
  }

  function handleSave() {
    setSaved(false)
    setError("")
    startTransition(async () => {
      const result = await saveIcAgreement(roleParam, langParam, body)
      if (result.success) {
        // Update local state
        setAgreements((prev) =>
          prev.map((a) =>
            a.role === roleParam && a.lang === langParam
              ? { ...a, body, version: (a.version ?? 1) + 1, updated_at: new Date().toISOString() }
              : a
          )
        )
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        setError(result.error ?? "Failed to save")
      }
    })
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/hiring" className="text-sm text-gray-400 hover:text-[#0D2240] transition-colors">
          ← Hiring
        </Link>
        <span className="text-gray-200">/</span>
        <h1 className="text-xl font-extrabold text-[#0D2240]">IC Agreements</h1>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-6">

        {/* Sidebar — role + lang picker */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Role</p>
          {ROLES.map((r) => (
            <div key={r.key}>
              <button
                onClick={() => nav(r.key, langParam)}
                className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all border ${
                  roleParam === r.key
                    ? "bg-[#0D2240] text-white border-[#0D2240]"
                    : "bg-white text-[#0D2240] border-gray-100 hover:border-[#0D2240]/30"
                }`}>
                <span className="text-base">{r.icon}</span>
                {r.label}
              </button>
              {/* Lang toggle under active role */}
              {roleParam === r.key && (
                <div className="flex gap-1.5 mt-1.5 px-1">
                  {(["en", "es"] as Lang[]).map((l) => (
                    <button
                      key={l}
                      onClick={() => nav(r.key, l)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold uppercase transition-all ${
                        langParam === l
                          ? "bg-[#E8726A] text-white"
                          : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                      }`}>
                      {l === "en" ? "🇺🇸 EN" : "🇪🇸 ES"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Meta info */}
          {current && !loading && (
            <div className="mt-4 bg-gray-50 rounded-xl p-4 text-xs text-gray-400 space-y-1.5 border border-gray-100">
              <p><span className="font-semibold text-gray-500">Version:</span> {current.version}</p>
              <p><span className="font-semibold text-gray-500">Updated:</span> {new Date(current.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
              {current.updated_by && (
                <p><span className="font-semibold text-gray-500">By:</span> {current.updated_by}</p>
              )}
              <p className="pt-1 text-[10px] leading-relaxed text-amber-600 font-semibold">
                ⚠ Changes are live immediately — new applicants will see the updated text.
              </p>
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-extrabold text-[#0D2240] text-base">
                {ROLES.find(r => r.key === roleParam)?.icon}{" "}
                {ROLES.find(r => r.key === roleParam)?.label} — {langParam === "en" ? "English" : "Spanish"}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                This is the contract text shown to applicants in the {langParam === "en" ? "EN" : "ES"} apply form
              </p>
            </div>
            <div className="flex items-center gap-2">
              {saved && (
                <span className="text-xs font-bold text-green-600 flex items-center gap-1">✓ Saved</span>
              )}
              {error && (
                <span className="text-xs font-bold text-red-500">{error}</span>
              )}
              <button
                onClick={handleSave}
                disabled={isPending || loading}
                className="bg-[#0D2240] hover:bg-[#1a3a5c] disabled:opacity-50 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl transition-colors uppercase tracking-wide">
                {isPending ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="h-96 flex items-center justify-center text-gray-300 text-sm">Loading…</div>
          ) : (
            <textarea
              value={body}
              onChange={(e) => { setBody(e.target.value); setSaved(false) }}
              rows={28}
              spellCheck={false}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-xs font-mono text-gray-700 leading-relaxed focus:outline-none focus:border-[#E8726A] resize-y"
              style={{ minHeight: "420px" }}
            />
          )}

          <div className="flex items-center justify-between pt-2 border-t border-gray-50">
            <p className="text-xs text-gray-400">
              {body.length.toLocaleString()} characters · {body.split("\n").length} lines
            </p>
            <button
              onClick={handleSave}
              disabled={isPending || loading}
              className="bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-50 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl transition-colors uppercase tracking-wide">
              {isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
