"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createWalkinOrder } from "@/app/actions/walkin"

export function WalkinForm() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serviceType, setServiceType] = useState<"comforter_wash" | "wash_fold" | "wash_only">("wash_fold")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const form = new FormData(e.currentTarget)
    try {
      await createWalkinOrder({
        customerName: form.get("customerName") as string,
        customerPhone: form.get("customerPhone") as string,
        customerEmail: (form.get("customerEmail") as string) || undefined,
        serviceType,
        numBags: parseInt(form.get("numBags") as string) || 1,
        numComforters: serviceType === "comforter_wash" ? parseInt(form.get("numBags") as string) || 1 : 0,
        pounds: form.get("pounds") ? parseFloat(form.get("pounds") as string) : undefined,
        detergent: (form.get("detergent") as string) || undefined,
        notes: (form.get("notes") as string) || undefined,
        totalAmount: Math.round(parseFloat(form.get("totalAmount") as string || "0") * 100),
      })
      router.refresh()
      ;(e.target as HTMLFormElement).reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create order")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Customer Name *</label>
          <input name="customerName" required className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Phone *</label>
          <input name="customerPhone" type="tel" required className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Email (optional)</label>
        <input name="customerEmail" type="email" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Service *</label>
          <select value={serviceType} onChange={e => setServiceType(e.target.value as typeof serviceType)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30">
            <option value="wash_fold">Wash &amp; Fold</option>
            <option value="wash_only">Wash Only</option>
            <option value="comforter_wash">Comforter Wash</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">
            {serviceType === "comforter_wash" ? "Comforters" : "Bags"} *
          </label>
          <input name="numBags" type="number" min="1" defaultValue="1" required
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
        </div>
        {serviceType !== "comforter_wash" && (
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Weight (lbs)</label>
            <input name="pounds" type="number" step="0.1" min="0" placeholder="optional"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Detergent (optional)</label>
          <input name="detergent" placeholder="Standard" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Total Charged ($) *</label>
          <input name="totalAmount" type="number" step="0.01" min="0" required
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Notes (optional)</label>
        <input name="notes" placeholder="Stains, special instructions…" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
      </div>

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      <button type="submit" disabled={saving}
        className="w-full bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold py-2.5 rounded-xl text-sm uppercase tracking-wide transition-colors disabled:opacity-50">
        {saving ? "Creating…" : "Create Drop-Off Order"}
      </button>
    </form>
  )
}
