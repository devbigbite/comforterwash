"use client"

import Link from "next/link"
import { useWorkerSession } from "@/components/pin-gate"

/**
 * Restricts an operator order-detail page to the worker it was assigned to
 * in dispatch (bookings.assigned_operator_id). Must be rendered inside a
 * <PinGate role="operator"> so a session is guaranteed to exist.
 *
 * The "owner" sentinel session always passes through, matching the
 * oversight access owners get elsewhere in the operator/driver tools.
 */
export function OperatorOrderGate({
  assignedOperatorId,
  children,
}: {
  assignedOperatorId: string | null
  children: React.ReactNode
}) {
  const session = useWorkerSession()
  const isOwner = session?.workerId === "owner"
  const isAssignedToMe = !!session && session.workerId === assignedOperatorId

  if (!isOwner && !isAssignedToMe) {
    return (
      <div className="min-h-screen bg-[#f7f8fb] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center max-w-sm">
          <p className="text-3xl mb-3">🔒</p>
          <p className="text-[#0D2240] font-extrabold text-lg">Not assigned to you</p>
          <p className="text-gray-400 text-base mt-1">
            This order hasn't been dispatched to you. Ask your manager if you think that's wrong.
          </p>
          <Link href="/operator"
            className="inline-block mt-5 bg-[#0D2240] text-white font-bold text-base px-6 py-3 rounded-xl">
            ← Back to my queue
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
