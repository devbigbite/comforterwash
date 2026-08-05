"use client"

/**
 * Web Serial transport for the operator bag-receipts printer. Added after
 * Web Bluetooth (bluetooth-printer.ts) turned out not to work against the
 * real PX-90B hardware: Chrome's Bluetooth device picker reported "No
 * compatible devices found," which means this printer isn't advertising
 * as Bluetooth Low Energy — its "Bluetooth 2.0/4.0" spec is classic
 * Bluetooth (SPP/serial), which Web Bluetooth cannot reach at all (a
 * browser-level restriction, not a misconfiguration).
 *
 * When a classic-Bluetooth printer is paired at the OS level, Windows
 * (and most desktop OSes) exposes it as a virtual COM port — the same
 * mechanism the USB connection would use. Web Serial can talk to that
 * port directly, bypassing Bluetooth entirely from the browser's point
 * of view once the OS pairing is done.
 */

const STORAGE_KEY = "washfold_printer_serial_granted"

export class SerialPrinterError extends Error {}

function isSupported(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator
}

export async function connectSerialPrinter(): Promise<SerialPort> {
  if (!isSupported()) {
    throw new SerialPrinterError(
      "This browser doesn't support Web Serial. Use Chrome or Edge on desktop."
    )
  }

  const port = await navigator.serial.requestPort()
  // Baud rate doesn't meaningfully matter for a Bluetooth-SPP virtual COM
  // port (there's no real physical UART clock to match), but Web Serial
  // requires a value — 9600 is the most broadly compatible default across
  // this class of printer firmware.
  await port.open({ baudRate: 9600 })
  localStorage.setItem(STORAGE_KEY, "1")
  return port
}

/** Reconnects to a previously-granted serial port without showing the
 *  picker dialog, if the browser still has one on file and it opens
 *  cleanly. Returns null otherwise (falls through to requestPort()). */
export async function reconnectSerialPrinter(): Promise<SerialPort | null> {
  if (!isSupported() || localStorage.getItem(STORAGE_KEY) !== "1") return null
  try {
    const ports = await navigator.serial.getPorts()
    if (!ports.length) return null
    const port = ports[0]
    await port.open({ baudRate: 9600 })
    return port
  } catch {
    return null
  }
}

export async function writeToSerialPrinter(port: SerialPort, bytes: Uint8Array) {
  if (!port.writable) throw new SerialPrinterError("Printer port isn't writable — try reconnecting.")
  const writer = port.writable.getWriter()
  try {
    await writer.write(bytes)
  } finally {
    writer.releaseLock()
  }
}
