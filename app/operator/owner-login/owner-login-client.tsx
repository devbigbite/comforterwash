"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function OwnerLoginClient() {
  const router = useRouter()

  useEffect(() => {
    localStorage.setItem(
      "washfold_operator_worker",
      JSON.stringify({ workerId: "owner", workerName: "Owner" })
    )
    router.replace("/operator/station")
  }, [router])

  return (
    <div className="min-h-screen bg-[#0D2240] flex flex-col items-center justify-center px-4">
      <div className="w-20 h-20 rounded-3xl bg-[#E8726A] flex items-center justify-center text-4xl mx-auto mb-6 animate-bounce">
        👑
      </div>
      <p className="text-white font-extrabold text-xl">Signing in as Owner…</p>
      <p className="text-white/50 text-sm mt-1">Redirecting to the Print Station</p>
    </div>
  )
}
