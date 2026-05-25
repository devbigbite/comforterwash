"use client"

import { useEffect, useState } from "react"
import { getAllPlans, createPlan, updatePlan, deletePlan, SubscriptionPlan } from "@/app/actions/subscription-plans"

const empty = {
  name: "",
  monthly_price_cents: 0,
  lbs_included: 0,
  overage_rate_cents: 0,
  is_popular: false,
  is_active: true,
  sort_order: 0,
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(empty)
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState(empty)
  const [error, setError] = useState("")

  async function load() {
    setLoading(true)
    setPlans(await getAllPlans())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function startEdit(plan: SubscriptionPlan) {
    setEditId(plan.id)
    setForm({
      name: plan.name,
      monthly_price_cents: plan.monthly_price_cents,
      lbs_included: plan.lbs_included,
      overage_rate_cents: plan.overage_rate_cents,
      is_popular: plan.is_popular,
      is_active: plan.is_active,
      sort_order: plan.sort_order,
    })
    setError("")
  }

  async function saveEdit() {
    if (!editId) return
    setSaving(true)
    const res = await updatePlan(editId, form)
    setSaving(false)
    if (!res.ok) { setError(res.error ?? "Save failed"); return }
    setEditId(null)
    load()
  }

  async function saveNew() {
    setSaving(true)
    const res = await createPlan(newForm)
    setSaving(false)
    if (!res.ok) { setError(res.error ?? "Create failed"); return }
    setShowNew(false)
    setNewForm(empty)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm("Archive this plan? Existing subscribers keep their plan.")) return
    await deletePlan(id)
    load()
  }

  function dollarsToCents(val: string) { return Math.round(parseFloat(val || "0") * 100) }
  function centsToDollars(cents: number) { return (cents / 100).toFixed(2) }

  const PlanForm = ({
    f, set, onSave, onCancel, isNew
  }: {
    f: typeof empty
    set: (v: typeof empty) => void
    onSave: () => void
    onCancel: () => void
    isNew?: boolean
  }) => (
    <div className="bg-[#f7f8fb] rounded-xl p-4 mt-2 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 font-medium">Plan Name</label>
          <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
            value={f.name} onChange={e => set({ ...f, name: e.target.value })} placeholder="e.g. Less Laundry" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Sort Order</label>
          <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
            value={f.sort_order} onChange={e => set({ ...f, sort_order: parseInt(e.target.value) || 0 })} />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Monthly Price ($)</label>
          <input type="number" step="0.01" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
            value={centsToDollars(f.monthly_price_cents)}
            onChange={e => set({ ...f, monthly_price_cents: dollarsToCents(e.target.value) })} />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Lbs Included / Month</label>
          <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
            value={f.lbs_included} onChange={e => set({ ...f, lbs_included: parseInt(e.target.value) || 0 })} />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Overage Rate ($/lb)</label>
          <input type="number" step="0.01" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
            value={centsToDollars(f.overage_rate_cents)}
            onChange={e => set({ ...f, overage_rate_cents: dollarsToCents(e.target.value) })} />
        </div>
        <div className="flex flex-col gap-2 justify-end pb-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={f.is_popular} onChange={e => set({ ...f, is_popular: e.target.checked })} />
            <span>Most Popular badge</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={f.is_active} onChange={e => set({ ...f, is_active: e.target.checked })} />
            <span>Active (visible to customers)</span>
          </label>
        </div>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving}
          className="bg-[#0D2240] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-[#0D2240]/90 disabled:opacity-50">
          {saving ? "Saving…" : isNew ? "Create Plan" : "Save Changes"}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0D2240]">Monthly Plans</h1>
          <p className="text-sm text-gray-500 mt-1">Admin-configurable subscription tiers shown on the pricing page</p>
        </div>
        {!showNew && (
          <button onClick={() => { setShowNew(true); setError("") }}
            className="bg-[#E8726A] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#E8726A]/90">
            + New Plan
          </button>
        )}
      </div>

      {showNew && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <h2 className="font-bold text-[#0D2240] mb-1">New Plan</h2>
          <PlanForm f={newForm} set={setNewForm} onSave={saveNew}
            onCancel={() => { setShowNew(false); setError("") }} isNew />
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading plans…</p>
      ) : plans.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-3xl mb-2">📋</p>
          <p>No plans yet. Create your first plan above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => (
            <div key={plan.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-[#0D2240] text-lg">{plan.name}</span>
                    {plan.is_popular && (
                      <span className="bg-[#E8726A]/10 text-[#E8726A] text-xs font-semibold px-2 py-0.5 rounded-full">
                        Most Popular
                      </span>
                    )}
                    {!plan.is_active && (
                      <span className="bg-gray-100 text-gray-400 text-xs font-medium px-2 py-0.5 rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 mt-1 text-sm text-gray-600 flex-wrap">
                    <span className="font-semibold text-[#E8726A]">
                      ${(plan.monthly_price_cents / 100).toFixed(0)}/mo
                    </span>
                    <span>{plan.lbs_included} lbs included</span>
                    <span>${(plan.overage_rate_cents / 100).toFixed(2)}/lb overage</span>
                    <span className="text-gray-400">Sort: {plan.sort_order}</span>
                  </div>
                  {plan.stripe_price_id && (
                    <p className="text-xs text-gray-300 mt-1 font-mono">{plan.stripe_price_id}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {editId !== plan.id && (
                    <>
                      <button onClick={() => startEdit(plan)}
                        className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(plan.id)}
                        className="text-sm px-3 py-1.5 border border-red-100 text-red-400 rounded-lg hover:bg-red-50">
                        Archive
                      </button>
                    </>
                  )}
                </div>
              </div>

              {editId === plan.id && (
                <PlanForm f={form} set={setForm} onSave={saveEdit}
                  onCancel={() => { setEditId(null); setError("") }} />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 bg-blue-50 rounded-xl p-4 text-sm text-blue-700">
        <strong>Note:</strong> Changing a plan's monthly price creates a new Stripe Price for future subscribers.
        Existing subscribers keep their current price until they are manually migrated in the Stripe dashboard.
        Archiving a plan hides it from the pricing page but does not cancel existing subscribers.
      </div>
    </div>
  )
}
