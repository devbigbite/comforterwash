"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { getAllLocations, updateLocation } from "@/app/actions/super-admin"

type Location = {
  id: string
  name: string
  slug: string
  custom_domain: string | null
  status: "active" | "inactive" | "suspended"
  plan: string | null
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  active:    "bg-green-100 text-green-700",
  inactive:  "bg-slate-100 text-slate-600",
  suspended: "bg-red-100 text-red-700",
}

const STATUS_CYCLE: Record<string, "active" | "inactive" | "suspended"> = {
  active:    "inactive",
  inactive:  "active",
  suspended: "active",
}

export default function SuperAdminPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading]     = useState(true)
  const [editId, setEditId]       = useState<string | null>(null)
  const [editName, setEditName]   = useState("")
  const [editDomain, setEditDomain] = useState("")
  const [editPlan, setEditPlan]   = useState("")
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [, startTransition]       = useTransition()

  async function load() {
    setLoading(true)
    const data = await getAllLocations()
    setLocations(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function startEdit(loc: Location) {
    setEditId(loc.id)
    setEditName(loc.name)
    setEditDomain(loc.custom_domain ?? "")
    setEditPlan(loc.plan ?? "")
    setError(null)
  }

  function cancelEdit() {
    setEditId(null)
    setError(null)
  }

  async function saveEdit(id: string) {
    setSaving(true)
    setError(null)
    const res = await updateLocation(id, {
      name:          editName.trim(),
      custom_domain: editDomain.trim() || null,
      plan:          editPlan.trim() || null,
    })
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setEditId(null)
    startTransition(() => { load() })
  }

  async function toggleStatus(loc: Location) {
    const next = STATUS_CYCLE[loc.status]
    await updateLocation(loc.id, { status: next })
    startTransition(() => { load() })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-sm">
        Loading locations…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Locations</h2>
          <p className="text-sm text-slate-500 mt-1">{locations.length} location{locations.length !== 1 ? "s" : ""} on the platform</p>
        </div>
        <Link
          href="/super-admin/locations/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Location
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="px-4 py-3 font-semibold text-slate-600">Name</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Slug</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Domain</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Plan</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Added</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {locations.map((loc) => (
              <tr key={loc.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                {editId === loc.id ? (
                  <>
                    {/* Edit row */}
                    <td className="px-4 py-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </td>
                    <td className="px-4 py-2 text-slate-400 text-xs font-mono">{loc.slug}</td>
                    <td className="px-4 py-2">
                      <input
                        value={editDomain}
                        onChange={(e) => setEditDomain(e.target.value)}
                        placeholder="custom-domain.com"
                        className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editPlan}
                        onChange={(e) => setEditPlan(e.target.value)}
                        placeholder="starter / pro"
                        className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[loc.status]}`}>
                        {loc.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-400 text-xs">
                      {new Date(loc.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => saveEdit(loc.id)}
                          disabled={saving}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >
                          Cancel
                        </button>
                      </div>
                      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                    </td>
                  </>
                ) : (
                  <>
                    {/* View row */}
                    <td className="px-4 py-3 font-medium text-slate-900">{loc.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{loc.slug}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{loc.custom_domain ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{loc.plan ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleStatus(loc)}
                        title="Click to toggle status"
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${STATUS_COLORS[loc.status]}`}
                      >
                        {loc.status}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {new Date(loc.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => startEdit(loc)}
                        className="text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors"
                      >
                        Edit
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {locations.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-sm">
                  No locations yet. <Link href="/super-admin/locations/new" className="text-indigo-600 hover:underline">Create the first one.</Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Location IDs reference */}
      <details className="text-xs text-slate-400">
        <summary className="cursor-pointer hover:text-slate-600">Show location IDs (for env vars)</summary>
        <div className="mt-2 space-y-1 font-mono bg-slate-100 rounded p-3">
          {locations.map((loc) => (
            <div key={loc.id}>
              <span className="text-slate-600">{loc.slug}:</span> {loc.id}
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
