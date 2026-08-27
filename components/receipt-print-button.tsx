"use client"

// Plain window.print() — no PDF library needed. The receipt page has
// print-only styling (print:hidden on chrome, print:block on the receipt
// itself) so "Print" here doubles as "Save as PDF" via the browser's print
// dialog, which is all a commercial customer needs to keep a copy of a
// per-order charge for their own records.
export function ReceiptPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden bg-[#0D2240] hover:bg-[#1a3a5c] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors"
    >
      🖨️ Print / Save as PDF
    </button>
  )
}
