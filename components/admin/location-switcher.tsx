"use client"

import { useState, useTransition } from "react"
import { switchAdminLocation, type MyLocationOption } from "@/app/admin/login/actions"

// Only rendered by AdminHeader when the current login actually has access to
// more than one location (see getMyLocations) -- most tenants have exactly
// one and never see this at all.
export function LocationSwitcher({ locations, currentId }: { locations: MyLocationOption[]; currentId: string }) {
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState(currentId)

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value
    setValue(next)
    if (next === currentId) return
    startTransition(async () => {
      const result = await switchAdminLocation(next)
      if (result?.error) setValue(currentId)
    })
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={isPending}
      className="bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-full px-3 py-1.5 border-none focus:outline-none focus:ring-1 focus:ring-white/30 disabled:opacity-50 cursor-pointer"
    >
      {locations.map(loc => (
        <option key={loc.id} value={loc.id} className="text-[#0D2240]">
          {loc.name}
        </option>
      ))}
    </select>
  )
}
