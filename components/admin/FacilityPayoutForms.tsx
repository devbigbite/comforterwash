import { issueFacilityPayout, recordManualFacilityPayment } from "@/app/actions/facility-payments"
import { PAYMENT_METHODS } from "@/lib/facility-payment-methods"

// Shared by /admin/facilities (inside each facility's Stripe & Payouts
// accordion) and /admin/facility-payments (the dedicated payments screen), so
// the two never drift apart. Not a client component — the <form action={...}>
// props are server actions.

const fld = "w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 bg-white"
const lbl = "text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1"

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
      {/* Stripe payout — only when the facility can actually receive one */}
      {stripeReady ? (
        <div className="border border-gray-200 rounded-xl p-4 bg-white">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Issue Payout via Stripe</p>
          <form action={issueFacilityPayout} className="space-y-2">
            <input type="hidden" name="facilityId" value={facilityId} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={lbl}>Period From</label>
                <input name="period_from" type="date" required defaultValue={defaultFrom} className={fld} />
              </div>
              <div>
                <label className={lbl}>Period To</label>
                <input name="period_to" type="date" required defaultValue={defaultTo} className={fld} />
              </div>
            </div>
            <div>
              <label className={lbl}>Amount Override (optional)</label>
              <input name="amount_override" inputMode="decimal" placeholder="Leave blank to pay the period total" className={fld} />
              <p className="text-[10px] text-gray-400 mt-1">
                Pays this dollar amount instead of the calculated order total. The difference is written into the payout notes.
              </p>
            </div>
            <div>
              <label className={lbl}>Notes (optional)</label>
              <input name="notes" placeholder="e.g. August week 3" className={fld} />
            </div>
            <button type="submit"
              className="w-full text-xs font-bold text-white bg-[#E8726A] hover:bg-[#d45f57] px-4 py-2 rounded-xl transition-colors uppercase tracking-wide">
              💸 Issue Payout via Stripe
            </button>
          </form>
        </div>
      ) : (
        <div className="border border-dashed border-gray-200 rounded-xl p-4 bg-white">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Stripe Payout Unavailable</p>
          <p className="text-[11px] text-gray-400">
            This facility hasn&apos;t finished Stripe Connect onboarding, so no transfer can be sent. You can still pay them
            directly and record it below.
          </p>
        </div>
      )}

      {/* Manual payment — always available, Stripe or not */}
      <div className="border border-gray-200 rounded-xl p-4 bg-white">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Record Manual Payment</p>
        <p className="text-[10px] text-gray-400 mb-3">
          Logs a payment you already made by cash, check or bank transfer. Moves no money — it only records it here and in the partner&apos;s Payments tab.
        </p>
        <form action={recordManualFacilityPayment} className="space-y-2">
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
          <button type="submit"
            className="w-full text-xs font-bold text-[#0D2240] bg-white border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-xl transition-colors uppercase tracking-wide">
            🧾 Record Manual Payment
          </button>
        </form>
      </div>
    </div>
  )
}
