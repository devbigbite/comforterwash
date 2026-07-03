"use client"
import { useRouter } from "next/navigation"

// Always show — lets any worker navigate to the other station
export function RoleSwitcher({ currentRole }: { currentRole: "operator" | "driver" }) {
  const router = useRouter()
  const otherRole = currentRole === "operator" ? "driver" : "operator"

  return (
    <button
      onClick={() => router.push(`/${otherRole}`)}
      className="flex items-center gap-1.5 text-white/50 hover:text-white text-xs font-medium transition-colors border border-white/20 hover:border-white/40 px-3 py-1.5 rounded-full"
    >
      {otherRole === "driver" ? "🚐" : "🏭"} Switch to {otherRole === "driver" ? "Driver" : "Operator"}
    </button>
  )
}
