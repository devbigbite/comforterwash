"use client"

import { useState, useTransition } from "react"
import { chargeMiscFeeToCardOnFile, waiveMiscFee, markFeePaid, type MiscFee } from "@/app/actions/fees"
import { FEE_PRESETS } from "@/lib/fee-presets"

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  paid:    "bg-green-50 text-green-700 border border-green-100",
  waived:  "bg-gray-100 text-gray-400",
  failed:  "bg-red-50 text-red-700 border border-red-200",
}

export function MiscFeesPanel({
  bookingId,
  initialFees,
}: {
  bookingId: string
  initialFees: MiscFee[]
}) {
  const [fees, setFees]             = useState<MiscFee[]>(initialFees)
  const [showForm, setShowForm]     = useState(false)
  const [selectedPreset, setPreset] = useState<number | null>(null)
  const [customLabel, setCustomLabel] = useState("")
  const [customAmount, setCustomAmount] = useState("")
  const [notes, setNotes]           = useState("")
  const [justCharged, setJustCharged] = useState<{ label: string; amountCents: number } | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [copiedId, setCopiedId]     = useState<string | null>(null)

  const isCustom   = selectedPreset === -1
  const label      = isCustom ? customLabel : (selectedPreset !== null ? FEE_PRESETS[selectedPreset]?.label ?? "" : "")
  const amountCents = isCustom
    ? Math.round(parseFloat(customAmount || "0") * 100)
    : (selectedPreset !== null ? FEE_PRESETS[selectedPreset]?.amount_cents ?? 0 : 0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!label || amountCents < 50) return
    setError(null)

    const fd = new FormData()
    fd.set("bookingId",   bookingId)
    fd.set("label",       label)
    fd.set("amountCents", String(amountCents))
    fd.set("notes",       notes)

    startTransition(async () => {
      // Charges the card already on file immediately, rather than handing
      // back a payment link -- a link only collects if the customer clicks
      // and pays it, which for something like a missed-pickup fee is
      // effectively "probably goes uncollected." See chargeMiscFeeToCardOnFile
      // in app/actions/fees.ts.
      const result = await chargeMiscFeeToCardOnFile(fd)
      if (result.error) {
        setError(result.error)
        // Still show it in the list as failed -- the row below reflects
        // what the server actually recorded on refresh, but the banner here
        // tells the admin right away what to do next (add a card, or waive).
      } else {
        setJustCharged({ label, amountCents })
        setFees(prev => [{
          id: crypto.randomUUID(),
          booking_id: bookingId,
          label,
          amount_cents: amountCents,
          payment_url: null,
          stripe_session_id: null,
          status: "paid",
          notes: notes || null,
          created_by: "admin",
          created_at: new Date().toISOString(),
        }, ...prev])
        setShowForm(false)
        setPreset(null)
        setCustomLabel("")
        setCustomAmount("")
        setNotes("")
      }
    })
  }

  async function handleWaive(feeId: string) {
    await waiveMiscFee(feeId, bookingId)
    setFees(f => f.map(x => x.id === feeId ? { ...x, status: "waived" } : x))
  }

  async function handleMarkPaid(feeId: string) {
    await markFeePaid(feeId, bookingId)
    setFees(f => f.map(x => x.id === feeId ? { ...x, status: "paid" } : x))
  }

  function copyUrl(url: string, id: string) {
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-[#0D2240] text-sm uppercase tracking-wide">💳 Misc Fees</h2>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setPaymentUrl(null) }}
            className="px-3 py-1.5 rounded-lg bg-[#E8726A] hover:bg-[#d45f57] text-white text-xs font-bold transition-colors"
          >
            + Add Fee
          </button>
        )}
      </div>

      {/* Charge confirmation banner */}
      {justCharged && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs font-bold text-green-700">
            ✅ Charged ${(justCharged.amountCents / 100).toFixed(2)} for {justCharged.label} to the card on file.
          </p>
        </div>
      )}

      {/* Add fee form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-5 bg-[#f7f8fb] border border-gray-100 rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-1">Select Fee Type</p>

          {/* Preset buttons */}
          <div className="flex flex-wrap gap-2">
            {FEE_PRESETS.map((preset, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPreset(i)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  selectedPreset === i
                    ? "bg-[#0D2240] text-white border-[#0D2240]"
                    : "bg-white text-[#0D2240] border-gray-200 hover:border-[#0D2240]"
                }`}
              >
                {preset.label} — ${(preset.amount_cents / 100).toFixed(2)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPreset(-1)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                selectedPreset === -1
                  ? "bg-[#0D2240] text-white border-[#0D2240]"
                  : "bg-white text-[#0D2240] border-gray-200 hover:border-[#0D2240]"
              }`}
            >
              Custom…
            </button>
          </div>

          {/* Custom fields */}
          {isCustom && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide block mb-1">Label</label>
                <input
                  type="text"
                  value={customLabel}
                  onChange={e => setCustomLabel(e.target.value)}
                  placeholder="e.g. Redelivery fee"
                  required
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-[#0D2240] placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide block mb-1">Amount ($)</label>
                <input
                  type="number"
                  min="0.50"
                  step="0.01"
                  value={customAmount}
                  onChange={e => setCustomAmount(e.target.value)}
                  placeholder="15.00"
                  required
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-[#0D2240] placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
                />
              </div>
            </div>
          )}

          {/* Notes */}
          {selectedPreset !== null && (
            <div>
              <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide block mb-1">Internal Note (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Customer was notified via text"
                className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-[#0D2240] placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 font-semibold">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending || selectedPreset === null || !label || amountCents < 50}
              className="px-4 py-2 rounded-lg bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 text-white text-xs font-bold transition-colors"
            >
              {isPending ? "Charging…" : `Charge Card on File — $${(amountCents / 100).toFixed(2)}`}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setPreset(null); setError(null) }}
              className="px-4 py-2 rounded-lg border border-gray-200 text-xs text-gray-500 hover:text-[#0D2240] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Fees list */}
      {fees.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-3">No misc fees on this order.</p>
      ) : (
        <div className="space-y-2">
          {fees.map(fee => (
            <div key={fee.id} className="flex items-center gap-3 rounded-xl bg-[#f7f8fb] border border-gray-100 p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-[#0D2240] text-sm">{fee.label}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_STYLES[fee.status]}`}>
                    {fee.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  ${(fee.amount_cents / 100).toFixed(2)}
                  {fee.notes && ` · ${fee.notes}`}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {fee.payment_url && fee.status === "pending" && (
                  <button
                    onClick={() => copyUrl(fee.payment_url!, fee.id)}
                    title="Copy payment link"
                    className="px-2.5 py-1.5 rounded-lg bg-[#0D2240] hover:bg-[#1a3a5c] text-white text-[10px] font-bold transition-colors"
                  >
                    {copiedId === fee.id ? "Copied!" : "📋 Copy Link"}
                  </button>
                )}
                {(fee.status === "pending" || fee.status === "failed") && (
                  <>
                    <button
                      onClick={() => handleMarkPaid(fee.id)}
                      title="Mark as paid manually — e.g. collected cash/Venmo after the card charge failed"
                      className="px-2.5 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold transition-colors"
                    >
                      ✓ Mark Paid
                    </button>
                    <button
                      onClick={() => handleWaive(fee.id)}
                      title="Waive this fee"
                      className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 text-[10px] font-bold transition-colors"
                    >
                      Waive
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
