"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function OperatorHome() {
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  async function lookup() {
    const cleaned = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
    if (cleaned.length < 6) { setError("Enter at least 6 characters of the order code"); return }
    setLoading(true)
    setError("")
    const supabase = createClient()
    const { data } = await supabase
      .from("bookings")
      .select("id")
      .ilike("id", `${cleaned}%`)
      .limit(1)
      .maybeSingle()
    setLoading(false)
    if (!data) { setError("Order not found. Check the code and try again."); return }
    router.push(`/operator/order/${data.id}`)
  }

  return (
    <div className="min-h-screen bg-[#0D2240] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-3xl bg-[#E8726A] flex items-center justify-center text-4xl mx-auto mb-4">
            🧺
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-1">Operator</h1>
          <p className="text-white/50 text-sm">WashFold Orlando Operations</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-2xl">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
            Order Code or Bag Label
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setError("") }}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            placeholder="e.g. 6618649D"
            className="w-full rounded-2xl border-2 border-gray-200 px-4 py-4 text-2xl font-mono font-bold text-[#0D2240] text-center tracking-widest focus:outline-none focus:border-[#E8726A] transition-colors uppercase"
            autoComplete="off"
            autoCapitalize="characters"
          />
          {error && <p className="text-sm text-red-500 font-medium mt-2 text-center">{error}</p>}
          <button
            onClick={lookup}
            disabled={loading || code.length < 6}
            className="w-full mt-4 bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 text-white font-extrabold text-lg py-4 rounded-2xl transition-colors"
          >
            {loading ? "Looking up…" : "Find Order →"}
          </button>
        </div>

        <div className="mt-6 text-center">
          <a href="/admin" className="text-white/30 text-sm hover:text-white/60 transition-colors">Admin Dashboard</a>
        </div>
      </div>
    </div>
  )
}
