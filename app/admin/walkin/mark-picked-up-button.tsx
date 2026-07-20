"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { markWalkinPickedUp } from "@/app/actions/walkin"

export function MarkPickedUpButton({ bookingId }: { bookingId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      await markWalkinPickedUp(bookingId)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-[10px] font-bold text-green-700 border border-green-200 bg-green-50 px-2.5 py-1.5 rounded-lg hover:bg-green-100 transition-colors uppercase disabled:opacity-50"
    >
      {loading ? "…" : "Mark Picked Up"}
    </button>
  )
}
