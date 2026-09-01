"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { addCityToMyAccount } from "@/app/actions/multi-city"
import { switchAdminLocation } from "@/app/admin/login/actions"

const TZ_OPTIONS = [
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Phoenix", label: "Mountain (no DST)" },
  { value: "America/Los_Angeles", label: "Pacific" },
  { value: "America/Anchorage", label: "Alaska" },
]

function nameToSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export function AddCityForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [slugEdited, setSlugEdited] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await addCityToMyAccount(fd)
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.locationId) {
        // Jump straight into the new city's admin, same as switching to any
        // other city you already have access to.
        await switchAdminLocation(result.locationId)
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">City Name *</label>
          <input
            name="city_name"
            required
            placeholder="Perfect Spin — New Orleans"
            onChange={e => {
              if (!slugEdited) {
                const form = e.currentTarget.form
                const slugInput = form?.elements.namedItem("slug") as HTMLInputElement | null
                if (slugInput) slugInput.value = nameToSlug(e.target.value)
              }
            }}
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Slug *</label>
          <input
            name="slug"
            required
            placeholder="new-orleans"
            onChange={() => setSlugEdited(true)}
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Address</label>
          <input
            name="address"
            placeholder="123 Main St, New Orleans, LA"
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Timezone</label>
          <select
            name="timezone"
            defaultValue="America/Chicago"
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
          >
            {TZ_OPTIONS.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-xl bg-[#E8726A] text-white font-bold text-sm px-5 py-2.5 hover:bg-[#d45f57] transition-colors disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create City"}
      </button>
    </form>
  )
}
