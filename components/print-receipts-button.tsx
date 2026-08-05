"use client"

import { useEffect, useState } from "react"
import { connectPrinter, reconnectPrinter, writeToPrinter, BluetoothPrinterError } from "@/lib/bluetooth-printer"
import { connectSerialPrinter, reconnectSerialPrinter, writeToSerialPrinter, SerialPrinterError } from "@/lib/serial-printer"
import { buildReceiptBytes, type ReceiptData } from "@/lib/escpos"

type Status = "idle" | "connecting" | "printing" | "error"
type Connection =
  | { kind: "bluetooth"; char: BluetoothRemoteGATTCharacteristic }
  | { kind: "serial"; port: SerialPort }
  | null

/**
 * Print trigger for the operator bag-receipts page. Prints directly to the
 * paired thermal printer (generic "PX-90B" style, no manufacturer SDK),
 * skipping the OS print dialog entirely.
 *
 * Two transports are supported because it wasn't known up front which one
 * this printer actually uses:
 *  - Web Bluetooth (BLE/GATT) — tried first.
 *  - Web Serial (virtual COM port) — this printer turned out to use
 *    classic Bluetooth (SPP), which Web Bluetooth cannot reach at all;
 *    once paired at the OS level it shows up as a normal serial port,
 *    which Web Serial *can* talk to directly.
 *
 * Falls back to the normal browser print dialog (window.print()) if
 * neither transport is supported or connecting/printing fails.
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
  const [connection, setConnection] = useState<Connection>(null)

  async function printVia(conn: NonNullable<Connection>) {
    setStatus("printing")
    setError(null)
    try {
      for (const receipt of receipts) {
        const bytes = buildReceiptBytes(receipt)
        if (conn.kind === "bluetooth") await writeToPrinter(conn.char, bytes)
        else await writeToSerialPrinter(conn.port, bytes)
      }
      setStatus("idle")
    } catch (err) {
      setStatus("error")
      setError(
        err instanceof BluetoothPrinterError || err instanceof SerialPrinterError
          ? err.message
          : "Printing failed — check the printer is on and connected."
      )
    }
  }

  async function handleBluetoothClick() {
    if (connection?.kind === "bluetooth") return printVia(connection)
    setStatus("connecting")
    setError(null)
    try {
      const char = await connectPrinter()
      const conn: Connection = { kind: "bluetooth", char }
      setConnection(conn)
      await printVia(conn)
    } catch (err) {
      setStatus("error")
      setError(
        err instanceof BluetoothPrinterError
          ? err.message + " This printer may use classic Bluetooth instead of BLE — try \"Connect via Serial/COM port\" below."
          : "Couldn't connect over Bluetooth."
      )
    }
  }

  async function handleSerialClick() {
    if (connection?.kind === "serial") return printVia(connection)
    setStatus("connecting")
    setError(null)
    try {
      const port = await connectSerialPrinter()
      const conn: Connection = { kind: "serial", port }
      setConnection(conn)
      await printVia(conn)
    } catch (err) {
      setStatus("error")
      setError(err instanceof SerialPrinterError ? err.message : "Couldn't connect over serial/COM port.")
    }
  }

  // Try a silent reconnect on load (no picker dialog — only works for a
  // device/port already granted permission in this browser). Tries
  // Bluetooth first, then serial. If one works and autoprint was
  // requested, print immediately.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const char = await reconnectPrinter()
      if (cancelled) return
      if (char) {
        const conn: Connection = { kind: "bluetooth", char }
        setConnection(conn)
        if (autoprint) printVia(conn)
        return
      }
      const port = await reconnectSerialPrinter()
      if (cancelled || !port) return
      const conn: Connection = { kind: "serial", port }
      setConnection(conn)
      if (autoprint) printVia(conn)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const busy = status === "connecting" || status === "printing"
  const mainLabel =
    status === "connecting" ? "Connecting…"
    : status === "printing" ? "Printing…"
    : connection ? "🖨️ Print All Receipts"
    : "🔗 Connect via Serial/COM Port"

  return (
    <div className="print-btn-wrap">
      <button
        className="btn-print"
        onClick={connection?.kind === "bluetooth" ? handleBluetoothClick : handleSerialClick}
        disabled={busy}
      >
        {mainLabel}
      </button>
      {!connection && (
        <button className="btn-print-alt" onClick={handleBluetoothClick} disabled={busy}>
          Try Bluetooth (BLE) instead
        </button>
      )}
      {error && (
        <div className="print-error">
          {error}
          <button className="btn-fallback" onClick={() => window.print()}>Use browser print dialog instead</button>
        </div>
      )}
    </div>
  )
}
