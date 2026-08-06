"use client"
import { useActionState } from "react"
import { createCommercialOrder } from "@/app/actions/commercial-accounts"

const initialState: { success?: boolean; error?: string; bookingId?: string } = {}

export function CreateOrderForm({ accountId }: { accountId: string }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => createCommercialOrder(formData),
    initialState,
  )

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="account_id" value={accountId} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Pickup Date</label>
          <input name="pickup_date" type="date" required className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-[#0D2240] bg-white" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Pickup Window</label>
          <input name="pickup_time_window" placeholder="9:00 AM - 12:00 PM" className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-[#0D2240] bg-white" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Delivery Date</label>
          <input name="delivery_date" type="date" className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-[#0D2240] bg-white" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Delivery Window</label>
          <input name="delivery_time_window" placeholder="9:00 AM - 12:00 PM" className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-[#0D2240] bg-white" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Bags</label>
          <input name="num_bags" type="number" min="1" defaultValue="1" className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-[#0D2240] bg-white" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Service Type</label>
          <select name="service_type" defaultValue="wash_fold" className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-[#0D2240] bg-white">
            <option value="wash_fold">Wash &amp; Fold</option>
            <option value="wash_only">Wash Only</option>
          </select>
        </div>
      </div>
      <p className="text-[11px] text-gray-400">
        No charge happens now — the account&apos;s card on file is charged automatically once the order is weighed at the facility,
        the same way a regular customer order flows through pickup, washing, and delivery.
      </p>

      {state.error && (
        <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          ⚠️ {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
          ✓ Order created — check dispatch.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full text-xs font-bold text-white bg-[#0D2240] hover:bg-[#16305c] px-4 py-2 rounded-xl transition-colors uppercase tracking-wide disabled:opacity-50"
      >
        {pending ? "Creating…" : "📦 Create Order"}
      </button>
    </form>
  )
}
