"use client"

import { useState, useTransition } from "react"
import {
  previewFacilityPayout,
  issueFacilityPayout,
  recordManualFacilityPayment,
  type PayoutPreview,
} from "@/app/actions/facility-payments"
import { PAYMENT_METHODS } from "@/lib/facility-payment-methods"

// Shared by /admin/facilities and /admin/facility-payments so the two can't
// drift. Client component: the Stripe payout is a two-step review → confirm,
// which needs local state, and both forms report their result inline instead
// of the silent re-render they used to do.

const fld = "w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 bg-white"
const lbl = "text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1"

function fmt$(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type Result = { kind: "ok" | "err"; message: string } | null

function ResultBanner({ result }: { result: Result }) {
  if (!result) return null
  return (
    <div className={`rounded-xl px-3 py-2 text-xs font-semibold border ${
      result.kind === "ok"
        ? "bg-green-50 text-green-700 border-green-200"
        : "bg-red-50 text-red-700 border-red-200"
    }`}>
      {result.kind === "ok" ? "✅ " : "⚠️ "}{result.message}
    </div>
  )
}

// ── Stripe payout: review, then confirm ──────────────────────────────────────
function StripePayoutForm({
  facilityId, defaultFrom, defaultTo,
}: { facilityId: string; defaultFrom?: string; defaultTo?: string }) {
  const [from, setFrom]         = useState(defaultFrom ?? "")
  const [to, setTo]             = useState(defaultTo ?? "")
  const [override, setOverride] = useState("")
  const [notes, setNotes]       = useState("")
  const [preview, setPreview]   = useState<PayoutPreview | null>(null)
  const [result, setResult]     = useState<Result>(null)
  const [pending, startTransition] = useTransition()

  function review() {
    setResult(null)
    startTransition(async () => {
      const p = await previewFacilityPayout(facilityId, from, to, override)
      if (p.error) { setResult({ kind: "err", message: p.error }); setPreview(null); return }
      setPreview(p)
    })
  }

  function confirmSend() {
    startTransition(async () => {
      const fd = new FormData()
      fd.set("facilityId", facilityId)
      fd.set("period_from", from)
      fd.set("period_to", to)
      fd.set("amount_override", override)
      fd.set("notes", notes)
      const r = await issueFacilityPayout(fd)
      if (r.error) {
        setResult({ kind: "err", message: r.error })
      } else {
        setResult({ kind: "ok", message: `Sent ${fmt$(r.amountCents ?? 0)} via Stripe.` })
        setPreview(null)
        setOverride("")
        setNotes("")
      }
    })
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Issue Payout via Stripe</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={lbl}>Period From</label>
          <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPreview(null) }} className={fld} />
        </div>
        <div>
          <label className={lbl}>Period To</label>
          <input type="date" value={to} onChange={e => { setTo(e.target.value); setPreview(null) }} className={fld} />
        </div>
      </div>

      <div>
        <label className={lbl}>Amount Override (optional)</label>
        <input value={override} inputMode="decimal" placeholder="Leave blank to pay the period total"
          onChange={e => { setOverride(e.target.value); setPreview(null) }} className={fld} />
        <p className="text-[10px] text-gray-400 mt-1">
          Pays this dollar amount instead of the calculated order total. The difference is written into the payout notes.
        </p>
      </div>

      <div>
        <label className={lbl}>Notes (optional)</label>
        <input value={notes} placeholder="e.g. August week 3" onChange={e => setNotes(e.target.value)} className={fld} />
      </div>

      <ResultBanner result={result} />

      {/* ── Review panel — nothing has hit Stripe at this point ───────────── */}
      {preview && (
        <div className="rounded-xl border border-gray-200 bg-[#f7f8fb] p-3 space-y-3">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">About to send</p>
              <p className="text-2xl font-extrabold text-[#0D2240]">{fmt$(preview.finalCents ?? 0)}</p>
            </div>
            <p className="text-[11px] text-gray-400">
              {preview.ordersCount} order{preview.ordersCount === 1 ? "" : "s"} · {(preview.totalLbs ?? 0).toFixed(1)} lbs
              {" · "}{from} – {to}
            </p>
          </div>

          {preview.overrideCents != null && preview.overrideCents !== preview.computedCents && (
            <p className="text-[11px] text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-2.5 py-1.5 font-semibold">
              Override in effect — orders total {fmt$(preview.computedCents ?? 0)}, you are sending {fmt$(preview.finalCents ?? 0)}.
            </p>
          )}

          {preview.exceedsOutstanding && (
            <p className="text-[11px] text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-2.5 py-1.5 font-semibold">
              This is more than the facility is owed — outstanding balance is {fmt$(Math.max(preview.outstandingCents ?? 0, 0))}.
            </p>
          )}

          {!!preview.overlapping?.length && (
            <div className="text-[11px] text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-2.5 py-1.5">
              <p className="font-bold mb-1">⚠️ This period overlaps {preview.overlapping.length} existing payment{preview.overlapping.length === 1 ? "" : "s"}:</p>
              {preview.overlapping.map(o => (
                <p key={o.id}>
                  {fmt$(o.amount_cents)} · {o.period_from} – {o.period_to} · {new Date(o.created_at).toLocaleDateString()}
                </p>
              ))}
              <p className="mt-1 font-semibold">Sending this would pay for the same work twice.</p>
            </div>
          )}

          {preview.ordersCount === 0 ? (
            <p className="text-[11px] text-gray-400">No billable orders in this period.</p>
          ) : (
            <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-100 bg-white">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-[9px] font-bold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="text-left px-2.5 py-1.5">Order</th>
                    <th className="text-left px-2.5 py-1.5">Delivered</th>
                    <th className="text-right px-2.5 py-1.5">Lbs</th>
                    <th className="text-right px-2.5 py-1.5">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {preview.orders?.map(o => (
                    <tr key={o.id}>
                      <td className="px-2.5 py-1.5 font-semibold text-[#0D2240]">{o.short_code ?? o.id.slice(0, 8)}</td>
                      <td className="px-2.5 py-1.5 text-gray-400">{o.delivery_date ?? "—"}</td>
                      <td className="px-2.5 py-1.5 text-right text-gray-500">{o.lbs != null ? o.lbs.toFixed(1) : "—"}</td>
                      <td className="px-2.5 py-1.5 text-right font-bold text-green-600">{fmt$(o.cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={confirmSend} disabled={pending || (preview.finalCents ?? 0) <= 0}
              className="flex-1 text-xs font-bold text-white bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 px-4 py-2 rounded-xl transition-colors uppercase tracking-wide">
              {pending ? "Sending…" : `💸 Confirm & send ${fmt$(preview.finalCents ?? 0)}`}
            </button>
            <button type="button" onClick={() => setPreview(null)} disabled={pending}
              className="text-xs font-bold text-gray-500 border border-gray-300 bg-white hover:bg-gray-50 px-4 py-2 rounded-xl transition-colors uppercase tracking-wide">
              Cancel
            </button>
          </div>
          <p className="text-[10px] text-gray-400 text-center">
            Nothing has been sent yet. Stripe transfers can only be reversed from the Stripe dashboard.
          </p>
        </div>
      )}

      {!preview && (
        <button type="button" onClick={review} disabled={pending || !from || !to}
          className="w-full text-xs font-bold text-white bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 px-4 py-2 rounded-xl transition-colors uppercase tracking-wide">
          {pending ? "Checking…" : "🔍 Review Payout"}
        </button>
      )}
    </div>
  )
}

// ── Manual payment ───────────────────────────────────────────────────────────
function ManualPaymentForm({ facilityId, placeholder }: { facilityId: string; placeholder: string }) {
  const [result, setResult] = useState<Result>(null)
  const [pending, startTransition] = useTransition()

  function submit(fd: FormData) {
    setResult(null)
    startTransition(async () => {
      const r = await recordManualFacilityPayment(fd)
      setResult(r.error
        ? { kind: "err", message: r.error }
        : { kind: "ok", message: `Recorded ${fmt$(r.amountCents ?? 0)}.` })
    })
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Record Manual Payment</p>
      <p className="text-[10px] text-gray-400 mb-3">
        Logs a payment you already made by cash, check or bank transfer. Moves no money — it only records it here and in the partner&apos;s Payments tab.
      </p>
      <form action={submit} className="space-y-2">
        <input type="hidden" name="facilityId" value={facilityId} />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={lbl}>Amount Paid</label>
            <input name="amount" required inputMode="decimal" placeholder={placeholder} className={fld} />
          </div>
          <div>
            <label className={lbl}>Method</label>
            <select name="payment_method" defaultValue="cash" className={fld}>
              {PAYMENT_METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={lbl}>Period From (optional)</label>
            <input name="period_from" type="date" className={fld} />
          </div>
          <div>
            <label className={lbl}>Period To (optional)</label>
            <input name="period_to" type="date" className={fld} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={lbl}>Reference (optional)</label>
            <input name="reference" placeholder="Check #1042" className={fld} />
          </div>
          <div>
            <label className={lbl}>Notes (optional)</label>
            <input name="notes" placeholder="e.g. paid in person" className={fld} />
          </div>
        </div>
        <ResultBanner result={result} />
        <button type="submit" disabled={pending}
          className="w-full text-xs font-bold text-[#0D2240] bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-40 px-4 py-2 rounded-xl transition-colors uppercase tracking-wide">
          {pending ? "Recording…" : "🧾 Record Manual Payment"}
        </button>
      </form>
    </div>
  )
}

export function FacilityPayoutForms({
  facilityId,
  stripeReady,
  suggestedAmount,
  defaultFrom,
  defaultTo,
}: {
  facilityId: string
  stripeReady: boolean
  /** Outstanding balance in cents, used only as the manual-payment placeholder. */
  suggestedAmount?: number
  defaultFrom?: string
  defaultTo?: string
}) {
  const placeholder = suggestedAmount && suggestedAmount > 0
    ? (suggestedAmount / 100).toFixed(2)
    : "112.10"

  return (
    <div className="space-y-3">
      {stripeReady ? (
        <StripePayoutForm facilityId={facilityId} defaultFrom={defaultFrom} defaultTo={defaultTo} />
      ) : (
        <div className="border border-dashed border-gray-200 rounded-xl p-4 bg-white">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Stripe Payout Unavailable</p>
          <p className="text-[11px] text-gray-400">
            This facility hasn&apos;t finished Stripe Connect onboarding, so no transfer can be sent. You can still pay them
            directly and record it below.
          </p>
        </div>
      )}
      <ManualPaymentForm facilityId={facilityId} placeholder={placeholder} />
    </div>
  )
}
