"use client"

import { useEffect, useState } from "react"
import { PinGate } from "@/components/pin-gate"
import { connectPrinter, reconnectPrinter, writeToPrinter, BluetoothPrinterError } from "@/lib/bluetooth-printer"
import { connectSerialPrinter, reconnectSerialPrinter, writeToSerialPrinter, SerialPrinterError } from "@/lib/serial-printer"
import { ReceiptBuilder } from "@/lib/escpos"

type Conn =
  | { kind: "bluetooth"; char: BluetoothRemoteGATTCharacteristic }
  | { kind: "serial"; port: SerialPort }
  | null

function testBytes(kind: string): Uint8Array {
  return new ReceiptBuilder()
    .init()
    .align("center")
    .bold(true)
    .size(2, 2)
    .line("PRINTER OK")
    .size(1, 1)
    .bold(false)
    .divider()
    .line("Test print from the operator app")
    .line("Connection: " + kind)
    .line(new Date().toLocaleString("en-US"))
    .cut()
    .build()
}

function PrinterSetup() {
  const [conn, setConn] = useState<Conn>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Silent reconnect to a printer this browser was already allowed to use.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const port = await reconnectSerialPrinter()
      if (cancelled) return
      if (port) { setConn({ kind: "serial", port }); return }
      const char = await reconnectPrinter()
      if (!cancelled && char) setConn({ kind: "bluetooth", char })
    })()
    return () => { cancelled = true }
  }, [])

  async function connect(kind: "serial" | "bluetooth") {
    setBusy(true)
    setMsg(null)
    try {
      if (kind === "serial") {
        setConn({ kind: "serial", port: await connectSerialPrinter() })
      } else {
        setConn({ kind: "bluetooth", char: await connectPrinter() })
      }
      setMsg({ ok: true, text: "Printer connected. Press Test print to confirm." })
    } catch (err) {
      const text =
        err instanceof SerialPrinterError || err instanceof BluetoothPrinterError
          ? err.message
          : "Couldn't connect to the printer."
      setMsg({ ok: false, text })
    }
    setBusy(false)
  }

  async function testPrint() {
    if (!conn) return
    setBusy(true)
    setMsg(null)
    try {
      const bytes = testBytes(conn.kind === "serial" ? "Serial / COM port" : "Bluetooth (BLE)")
      if (conn.kind === "serial") await writeToSerialPrinter(conn.port, bytes)
      else await writeToPrinter(conn.char, bytes)
      setMsg({ ok: true, text: "Sent. If the paper came out, you're all set." })
    } catch (err) {
      const text =
        err instanceof SerialPrinterError || err instanceof BluetoothPrinterError
          ? err.message
          : "Printing failed. Check the printer is on and connected."
      setMsg({ ok: false, text })
    }
    setBusy(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <h1 className="text-xl font-black text-[#0D2240]">🖨️ Printer setup</h1>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
          <p className="text-sm font-bold text-[#0D2240]">Status</p>
          <p className={`text-sm ${conn ? "text-green-600" : "text-gray-500"}`}>
            {conn
              ? `Connected (${conn.kind === "serial" ? "Serial / COM port" : "Bluetooth BLE"})`
              : "Not connected on this browser"}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <p className="text-sm font-bold text-[#0D2240]">1. Pair the printer</p>
          <p className="text-xs text-gray-500">
            First pair the printer in this device&apos;s Bluetooth settings (turn the printer on and pick it from the list).
          </p>
          <p className="text-sm font-bold text-[#0D2240] pt-2">2. Connect</p>
          <button
            onClick={() => connect("serial")}
            disabled={busy}
            className="w-full bg-[#0D2240] text-white font-bold text-sm px-4 py-3 rounded-xl disabled:opacity-50"
          >
            Connect via Serial / COM port (recommended)
          </button>
          <button
            onClick={() => connect("bluetooth")}
            disabled={busy}
            className="w-full border border-gray-200 text-[#0D2240] font-bold text-sm px-4 py-3 rounded-xl disabled:opacity-50"
          >
            Try Bluetooth (BLE) instead
          </button>
          <p className="text-sm font-bold text-[#0D2240] pt-2">3. Test</p>
          <button
            onClick={testPrint}
            disabled={busy || !conn}
            className="w-full bg-[#E8726A] text-white font-bold text-sm px-4 py-3 rounded-xl disabled:opacity-50"
          >
            {busy ? "Working…" : "Test print"}
          </button>
        </div>

        {msg && (
          <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>
        )}

        <p className="text-xs text-gray-400">
          Works in Chrome or Edge on a computer or Android. Not available on iPhone. This browser remembers the
          printer, so you only need to do this once per device.
        </p>
      </div>
    </div>
  )
}

export default function PrinterPage() {
  return (
    <PinGate role="operator">
      <PrinterSetup />
    </PinGate>
  )
}
