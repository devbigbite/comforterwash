"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { getAllLocations, updateLocation, inviteLocationAdmin, getLocationAdmins, removeLocationAdmin, deleteLocation, type DeleteLocationResult } from "@/app/actions/super-admin"
import { setLocationPlanPrice, createBillingCheckoutLink, cancelLocationBilling } from "@/app/actions/platform-billing"

type Location = {
  id: string
  name: string
  slug: string
  custom_domain: string | null
  status: "active" | "inactive" | "suspended"
  plan: string | null
  created_at: string
  billing_status: string
  plan_price_cents: number | null
  plan_name: string | null
}

const BILLING_COLORS: Record<string, string> = {
  none:      "bg-slate-100 text-slate-500",
  trialing:  "bg-blue-100 text-blue-700",
  active:    "bg-green-100 text-green-700",
  past_due:  "bg-amber-100 text-amber-700",
  canceled:  "bg-red-100 text-red-700",
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

  // Admin invite / management
  const [adminsForId, setAdminsForId] = useState<string | null>(null)
  const [admins, setAdmins] = useState<{ user_id: string; email: string; role: string; is_super_admin: boolean }[]>([])
  const [loadingAdmins, setLoadingAdmins] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  // Billing modal
  const [billingForId, setBillingForId] = useState<string | null>(null)
  const [billPlanName, setBillPlanName] = useState("")
  const [billPriceDollars, setBillPriceDollars] = useState("")
  const [billSaving, setBillSaving] = useState(false)
  const [billMsg, setBillMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)

  // Delete
  const [deleteForId, setDeleteForId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteResult, setDeleteResult] = useState<DeleteLocationResult | null>(null)

  async function handleDelete(force: boolean) {
    if (!deleteForId) return
    setDeleting(true)
    const res = await deleteLocation(deleteForId, force)
    setDeleting(false)
    setDeleteResult(res)
    if (res.deleted) {
      setDeleteForId(null)
      startTransition(() => { load() })
    }
  }

  function openBilling(loc: Location) {
    setBillingForId(loc.id)
    setBillPlanName(loc.plan_name ?? "")
    setBillPriceDollars(loc.plan_price_cents ? (loc.plan_price_cents / 100).toFixed(2) : "")
    setBillMsg(null)
    setCheckoutUrl(null)
  }

  async function handleSavePlanPrice() {
    if (!billingForId) return
    setBillSaving(true)
    setBillMsg(null)
    const cents = Math.round(parseFloat(billPriceDollars || "0") * 100)
    const res = await setLocationPlanPrice(billingForId, billPlanName, cents)
    setBillSaving(false)
    if (res.error) { setBillMsg({ type: "err", text: res.error }); return }
    setBillMsg({ type: "ok", text: "Plan price saved." })
    startTransition(() => { load() })
  }

  async function handleCreateCheckoutLink() {
    if (!billingForId) return
    setBillSaving(true)
    setBillMsg(null)
    const res = await createBillingCheckoutLink(billingForId)
    setBillSaving(false)
    if (res.error) { setBillMsg({ type: "err", text: res.error }); return }
    setCheckoutUrl(res.url ?? null)
  }

  async function handleCancelBilling() {
    if (!billingForId) return
    if (!confirm("Cancel this tenant's platform subscription immediately?")) return
    setBillSaving(true)
    const res = await cancelLocationBilling(billingForId)
    setBillSaving(false)
    if (res.error) { setBillMsg({ type: "err", text: res.error }); return }
    setBillMsg({ type: "ok", text: "Subscription cancelled." })
    startTransition(() => { load() })
  }

  async function openAdmins(locId: string) {
    setAdminsForId(locId)
    setInviteEmail("")
    setInviteMsg(null)
    setLoadingAdmins(true)
    const data = await getLocationAdmins(locId)
    setAdmins(data)
    setLoadingAdmins(false)
  }

  async function handleInvite() {
    if (!adminsForId || !inviteEmail.trim()) return
    setInviting(true)
    setInviteMsg(null)
    const result = await inviteLocationAdmin(adminsForId, inviteEmail.trim())
    setInviting(false)
    if (result.error) { setInviteMsg({ type: "err", text: result.error }); return }
    setInviteMsg({ type: "ok", text: `Sign-in link sent to ${inviteEmail}.` })
    setInviteEmail("")
    const data = await getLocationAdmins(adminsForId)
    setAdmins(data)
  }

  async function handleRemoveAdmin(userId: string) {
    if (!adminsForId) return
    if (!confirm("Remove this admin's access to this location?")) return
    await removeLocationAdmin(adminsForId, userId)
    const data = await getLocationAdmins(adminsForId)
    setAdmins(data)
  }

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
              <th className="px-4 py-3 font-semibold text-slate-600">Billing</th>
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
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${BILLING_COLORS[loc.billing_status] ?? BILLING_COLORS.none}`}>
                        {loc.billing_status}
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
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openBilling(loc)}
                        title="Manage billing"
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${BILLING_COLORS[loc.billing_status] ?? BILLING_COLORS.none}`}
                      >
                        {loc.billing_status}{loc.plan_price_cents ? ` · $${(loc.plan_price_cents / 100).toFixed(0)}/mo` : ""}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {new Date(loc.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => startEdit(loc)}
                          className="text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openAdmins(loc.id)}
                          className="text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors"
                        >
                          Admins
                        </button>
                        <button
                          onClick={() => openBilling(loc)}
                          className="text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors"
                        >
                          Billing
                        </button>
                        <button
                          onClick={() => { setDeleteForId(loc.id); setDeleteResult(null) }}
                          className="text-xs font-medium text-slate-400 hover:text-red-600 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {locations.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-sm">
                  No locations yet. <Link href="/super-admin/locations/new" className="text-indigo-600 hover:underline">Create the first one.</Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Admins modal ─────────────────────────────────────────────── */}
      {adminsForId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setAdminsForId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                Admins — {locations.find(l => l.id === adminsForId)?.name}
              </h3>
              <button onClick={() => setAdminsForId(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {loadingAdmins ? (
              <p className="text-sm text-slate-400 py-4 text-center">Loading…</p>
            ) : (
              <div className="space-y-2 mb-5">
                {admins.length === 0 && (
                  <p className="text-sm text-slate-400 py-2">No admins yet — invite the first one below.</p>
                )}
                {admins.map(a => (
                  <div key={a.user_id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{a.email}</p>
                      <p className="text-xs text-slate-400">{a.is_super_admin ? "Super admin" : a.role}</p>
                    </div>
                    {!a.is_super_admin && (
                      <button onClick={() => handleRemoveAdmin(a.user_id)} className="text-xs text-red-500 hover:text-red-700 font-medium">
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-slate-100 pt-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Invite an admin</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="admin@theirbusiness.com"
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {inviting ? "Sending…" : "Invite"}
                </button>
              </div>
              {inviteMsg && (
                <p className={`text-xs mt-2 font-medium ${inviteMsg.type === "ok" ? "text-green-600" : "text-red-500"}`}>
                  {inviteMsg.text}
                </p>
              )}
              <p className="text-xs text-slate-400 mt-2">
                They'll get an email with a one-time sign-in link — no password to set up.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Billing modal ────────────────────────────────────────────── */}
      {billingForId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setBillingForId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                Billing — {locations.find(l => l.id === billingForId)?.name}
              </h3>
              <button onClick={() => setBillingForId(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Plan name</label>
                <input
                  value={billPlanName}
                  onChange={e => setBillPlanName(e.target.value)}
                  placeholder="Starter"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Monthly price ($)</label>
                <input
                  type="number" step="0.01" min="0"
                  value={billPriceDollars}
                  onChange={e => setBillPriceDollars(e.target.value)}
                  placeholder="99.00"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <button
                onClick={handleSavePlanPrice}
                disabled={billSaving}
                className="w-full bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                {billSaving ? "Saving…" : "Save Plan Price"}
              </button>

              <div className="border-t border-slate-100 pt-4">
                <button
                  onClick={handleCreateCheckoutLink}
                  disabled={billSaving}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  {billSaving ? "Generating…" : "Generate Checkout Link"}
                </button>
                {checkoutUrl && (
                  <div className="mt-3 bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Send this to the tenant — they enter their own card:</p>
                    <a href={checkoutUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline break-all">{checkoutUrl}</a>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-4">
                <button
                  onClick={handleCancelBilling}
                  disabled={billSaving}
                  className="w-full text-red-600 hover:text-red-700 text-sm font-medium py-2 disabled:opacity-50"
                >
                  Cancel Subscription
                </button>
              </div>

              {billMsg && (
                <p className={`text-xs font-medium ${billMsg.type === "ok" ? "text-green-600" : "text-red-500"}`}>
                  {billMsg.text}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete modal ─────────────────────────────────────────────── */}
      {deleteForId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => !deleting && setDeleteForId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                Delete — {locations.find(l => l.id === deleteForId)?.name}
              </h3>
              <button onClick={() => setDeleteForId(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {!deleteResult?.blocked ? (
              <>
                <p className="text-sm text-slate-500 mb-5">
                  This permanently deletes the location and all of its data — bookings, workers, facilities, settings, everything. This cannot be undone.
                </p>
                {deleteResult?.error && (
                  <p className="text-xs text-red-500 mb-3">{deleteResult.error}</p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDelete(false)}
                    disabled={deleting}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                  >
                    {deleting ? "Checking…" : "Delete Location"}
                  </button>
                  <button onClick={() => setDeleteForId(null)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-700 mb-2 font-medium">
                  This location has real data and can't be deleted by default:
                </p>
                <ul className="text-sm text-slate-500 mb-5 space-y-1">
                  <li>{deleteResult.counts?.bookings ?? 0} bookings</li>
                  <li>{deleteResult.counts?.workers ?? 0} workers</li>
                  <li>{deleteResult.counts?.subscriptions ?? 0} subscriptions</li>
                </ul>
                <p className="text-xs text-red-500 mb-4">
                  Forcing deletion here permanently wipes all of it — only do this if you're certain.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDelete(true)}
                    disabled={deleting}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                  >
                    {deleting ? "Deleting…" : "Delete Anyway"}
                  </button>
                  <button onClick={() => setDeleteForId(null)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
