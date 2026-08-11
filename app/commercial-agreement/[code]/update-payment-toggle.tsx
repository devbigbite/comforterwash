"use client"

import { useState } from "react"
import CommercialCardSetup from "@/components/commercial-card-setup"

// Small reveal-on-click wrapper around CommercialCardSetup so the update
// flow doesn't clutter the page (or spin up a Stripe Embedded Checkout
// session) for the common case where the customer is just checking their
// account status, not actively updating their card.
export function UpdatePaymentToggle({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false)
  const [justUpdated, setJustUpdated] = useState(false)

  if (justUpdated) {
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center text-sm font-semibold text-green-700">
        ✅ Payment method updated — thank you!
      </div>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border-2 border-[#0D2240] text-[#0D2240] font-bold text-sm py-2.5 hover:bg-[#0D2240] hover:text-white transition-colors"
      >
        💳 Update Payment Method
      </button>
    )
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-2">Your new card is saved securely with Stripe — nothing is charged now.</p>
      <CommercialCardSetup accountId={accountId} onSuccess={() => setJustUpdated(true)} />
    </div>
  )
}
