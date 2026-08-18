"use client"

import { useState } from "react"
import { useFormStatus } from "react-dom"

// Collapsed by default: on a normal order nobody is editing the address, and
// an always-open pair of text boxes invites accidental edits to the one field
// the driver depends on. Opens only when someone deliberately clicks Edit.

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-[#0D2240] hover:bg-[#16305a] disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
    >
      {pending ? "Saving…" : "Save Address"}
    </button>
  )
}

export function AddressEditPanel({
  bookingId,
  customerAddress,
  deliveryAddress,
  hasShipday,
  action,
}: {
  bookingId: string
  customerAddress: string
  deliveryAddress: string
  hasShipday: boolean
  action: (formData: FormData) => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [pickup, setPickup] = useState(customerAddress ?? "")
  const [delivery, setDelivery] = useState(deliveryAddress ?? "")
  // Most orders deliver where they were picked up. Keeping them linked means a
  // correction to one can't silently leave the other pointing at the old place
  // — the exact failure mode that makes a half-fixed address so dangerous.
  const [same, setSame] = useState((customerAddress ?? "") === (deliveryAddress ?? ""))

  const inputCls =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 focus:border-[#E8726A]"

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-[#E8726A] hover:underline"
      >
        ✏️ Edit address
      </button>
    )
  }

  return (
    <form action={action} className="space-y-3 bg-[#f7f8fb] border border-gray-200 rounded-xl p-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="deliveryAddress" value={same ? pickup : delivery} />

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1">
          Pickup Address
        </label>
        <input
          name="customerAddress"
          value={pickup}
          onChange={e => setPickup(e.target.value)}
          placeholder="123 Main St, Apt 4B, Orlando, FL 32801"
          className={inputCls}
        />
        <p className="text-[11px] text-gray-400 mt-1">
          Include the apartment or unit number as its own comma segment, e.g. <span className="font-mono">Apt 302</span>.
        </p>
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
        <input type="checkbox" checked={same} onChange={e => setSame(e.target.checked)} />
        Delivery goes to the same address
      </label>

      {!same && (
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1">
            Delivery Address
          </label>
          <input
            value={delivery}
            onChange={e => setDelivery(e.target.value)}
            placeholder="123 Main St, Apt 4B, Orlando, FL 32801"
            className={inputCls}
          />
        </div>
      )}

      <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
        {hasShipday
          ? "Saving also updates this order's stops in Shipday. If Shipday rejects it you'll see a warning here — fix it there by hand, or the driver routes to the old address."
          : "This order has no Shipday stops yet, so there's nothing to re-sync."}
        {" "}Labels already printed and emails already sent keep the old address.
      </p>

      <div className="flex items-center gap-3">
        <SaveButton />
        <button
          type="button"
          onClick={() => {
            setPickup(customerAddress ?? "")
            setDelivery(deliveryAddress ?? "")
            setSame((customerAddress ?? "") === (deliveryAddress ?? ""))
            setOpen(false)
          }}
          className="text-xs font-semibold text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
