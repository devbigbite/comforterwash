"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createLocation } from "@/app/actions/super-admin"

export default function NewLocationPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // Auto-generate slug from name
  function nameToSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await createLocation(formData)

    setSaving(false)
    if (result.error) {
      setError(result.error)
    } else {
      router.push("/super-admin")
    }
  }

  return (
    <div className="max-w-xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
        <Link href="/super-admin" className="hover:text-indigo-600">Locations</Link>
        <span>/</span>
        <span className="text-slate-700 font-medium">New Location</span>
      </div>

      <h2 className="text-2xl font-bold text-slate-900 mb-1">Add a Location</h2>
      <p className="text-sm text-slate-500 mb-8">
        Each location gets its own subdomain (e.g. <code className="bg-slate-100 px-1 rounded">miami.washfold.com</code>) and fully isolated data.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-xl border border-slate-200 p-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Location Name <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            required
            placeholder="WashFold Miami"
            onChange={(e) => {
              const slugInput = e.currentTarget.form?.elements.namedItem("slug") as HTMLInputElement
              if (slugInput && !slugInput.dataset.edited) {
                slugInput.value = nameToSlug(e.target.value)
              }
            }}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* Slug */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Slug <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-0 border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-400">
            <span className="px-3 py-2 bg-slate-50 text-slate-400 text-sm border-r border-slate-300 select-none">
              {process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "washfold.com"}/
            </span>
            <input
              name="slug"
              required
              placeholder="miami"
              onInput={(e) => {
                (e.target as HTMLInputElement).dataset.edited = "true"
              }}
              className="flex-1 px-3 py-2 text-sm focus:outline-none bg-white"
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">Lowercase letters, numbers, and hyphens only. Cannot be changed later.</p>
        </div>

        {/* Custom Domain */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Custom Domain <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            name="custom_domain"
            placeholder="miami.washfold.com"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <p className="text-xs text-slate-400 mt-1">Used for white-label or vanity domains pointing to this location.</p>
        </div>

        {/* Plan */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Plan <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <select
            name="plan"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          >
            <option value="">— none —</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? "Creating…" : "Create Location"}
          </button>
          <Link
            href="/super-admin"
            className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
