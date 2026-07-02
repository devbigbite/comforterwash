"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

const SESSION_KEY = (role: string) => `washfold_${role}_worker`

export function RoleSwitcher({ currentRole }: { currentRole: "operator" | "driver" }) {
  const [hasOtherRole, setHasOtherRole] = useState(false)
  const router = useRouter()
  const otherRole = currentRole === "operator" ? "driver" : "operator"

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY(currentRole))
      if (!raw) return
      const session = JSON.parse(raw)
      if (session?.roles?.includes(otherRole)) setHasOtherRole(true)
    } catch {}
  }, [currentRole, otherRole])

  if (!hasOtherRole) return null

  function switchRole() {
    router.push(`/${otherRole}`)
  }

  return (
    <button
      onClick={switchRole}
      className="flex items-center gap-1.5 text-white/50 hover:text-white text-xs font-medium transition-colors border border-white/20 hover:border-white/40 px-3 py-1.5 rounded-full"
    >
      {otherRole === "driver" ? "🚐" : "🏭"} Switch to {otherRole === "driver" ? "Driver" : "Operator"}
    </button>
  )
}
