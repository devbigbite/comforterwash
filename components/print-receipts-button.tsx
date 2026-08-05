"use client"

import { useEffect, useState } from "react"
import { connectPrinter, reconnectPrinter, writeToPrinter, BluetoothPrinterError } from "@/lib/bluetooth-printer"
import { buildReceiptBytes, type ReceiptData } from "@/lib/escpos"

type Status = "idle" | "connecting" | "printing" | "error"

/**
 * Print trigger for the operator bag-receipts page. Prints directly to the
 * paired Bluetooth thermal printer (generic "PX-90B" style, no manufacturer
 * SDK) via Web Bluetooth + raw ESC/POS commands — skips the OS print dialog
 * entirely, since the shop wants receipts to go straight to that one
 * printer without picking a destination each time.
 *
 * Falls back to the normal browser print dialog (window.print(), same as
 * before) if Web Bluetooth isn't supported in this browser or the printer
 * connection fails, so nothing is lost on unsupported devices.
 */
export function PrintReceiptsButton({
  receipts,
  autoprint,
}: {
  receipts: ReceiptData[]
  autoprint: boolean
}) {
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)
  const [charRef, setCharRef] = useState<BluetoothRemoteGATTCharacteristic | null>(null)

  async function printViaBluetooth(char: BluetoothRemoteGATTCharacteristic) {
    setStatus("printing")
    setError(null)
    try {
      for (const receipt of receipts) {
        await writeToPrinter(char, buildReceiptBytes(receipt))
      }
      setStatus("idle")
    } catch (err) {
      setStatus("error")
      setError(err instanceof BluetoothPrinterError ? err.message : "Printing failed — check the printer is on and paired.")
    }
  }

  async function handleClick() {
    if (charRef) {
      await printViaBluetooth(charRef)
      return
    }
    setStatus("connecting")
    setError(null)
    try {
      const char = await connectPrinter()
      setCharRef(char)
      await printViaBluetooth(char)
    } catch (err) {
      setStatus("error")
      setError(err instanceof BluetoothPrinterError ? err.message : "Couldn't connect to the printer.")
    }
  }

  // Try a silent reconnect to the last-paired printer on load (no picker
  // dialog — only works for a device already granted permission in this
  // browser). If it works and autoprint was requested, print immediately.
  useEffect(() => {
    let cancelled = false
    reconnectPrinter().then(char => {
      if (cancelled || !char) return
      setCharRef(char)
      if (autoprint) printViaBluetooth(char)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const label =
    status === "connecting" ? "Connecting…"
    : status === "printing" ? "Printing…"
    : charRef ? "🖨️ Print All Receipts"
    : "🔗 Connect & Print"

  return (
    <div className="print-btn-wrap">
      <button
        className="btn-print"
        onClick={handleClick}
        disabled={status === "connecting" || status === "printing"}
      >
        {label}
      </button>
      {error && (
        <div className="print-error">
          {error}
          <button className="btn-fallback" onClick={() => window.print()}>Use browser print dialog instead</button>
        </div>
      )}
    </div>
  )
}
