"use client"

import { useEffect } from "react"

/**
 * Print trigger for the operator bag-receipts page. Split out as its own
 * client component because the receipts page itself is a Server Component
 * nested inside PinGate/OperatorOrderGate (both "use client") — an inline
 * <script> injected via dangerouslySetInnerHTML inside that hydrated tree
 * isn't reliably executed by React, which was why the button previously
 * did nothing and the receipts never rendered. Receipts are now built as
 * real server-rendered JSX; this component only owns the actual
 * window.print() call.
 */
export function PrintReceiptsButton({ autoprint }: { autoprint: boolean }) {
  useEffect(() => {
    if (!autoprint) return
    // Give the receipts a beat to lay out before invoking the print dialog.
    const t = setTimeout(() => window.print(), 300)
    return () => clearTimeout(t)
  }, [autoprint])

  return (
    <button className="btn-print" onClick={() => window.print()}>
      🖨️ Print All Receipts
    </button>
  )
}
