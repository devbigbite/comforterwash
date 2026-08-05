"use client"

/**
 * Web Bluetooth transport for the operator bag-receipts printer (generic
 * "PX-90B" style 80mm thermal printer — no manufacturer SDK). This class
 * of cheap Chinese thermal printers almost universally reuses the same
 * white-label BLE chipset exposing a "transparent UART" service, so we try
 * that well-known service/characteristic pair first. If a given unit uses
 * different UUIDs, we fall back to scanning all of its GATT services for
 * any characteristic that supports write — nearly every BLE thermal
 * printer has exactly one such characteristic, so this keeps the feature
 * working even if this exact model's UUIDs turn out to differ once tested
 * against the real hardware.
 *
 * The device id is remembered in localStorage so returning to this page
 * later can reconnect via navigator.bluetooth.getDevices() (already-
 * granted permission) without re-prompting the operator every single time.
 */

const UART_SERVICE = "49535343-fe7d-4ae5-8fa9-9fafd205e455"
const UART_WRITE_CHAR = "49535343-8841-43f4-a8d4-ecbe34729bb3"

const STORAGE_KEY = "washfold_printer_device_id"

// Web Bluetooth GATT writes are commonly capped around 20 bytes per call
// on older stacks/MTU negotiations — chunk everything to be safe rather
// than assume a larger MTU was negotiated.
const CHUNK_SIZE = 180

export class BluetoothPrinterError extends Error {}

function isSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator
}

async function findWriteCharacteristic(
  server: BluetoothRemoteGATTServer
): Promise<BluetoothRemoteGATTCharacteristic> {
  // Preferred path: the common transparent-UART service most white-label
  // BLE thermal printers (including likely this one) expose.
  try {
    const service = await server.getPrimaryService(UART_SERVICE)
    return await service.getCharacteristic(UART_WRITE_CHAR)
  } catch {
    // Fall through to generic discovery below.
  }

  // Fallback: scan every service/characteristic on the device for the
  // first one that supports write or writeWithoutResponse.
  const services = await server.getPrimaryServices()
  for (const service of services) {
    const chars = await service.getCharacteristics()
    for (const char of chars) {
      if (char.properties.write || char.properties.writeWithoutResponse) {
        return char
      }
    }
  }

  throw new BluetoothPrinterError(
    "Couldn't find a writable Bluetooth characteristic on this printer. It may use a different BLE profile than expected — check with the printer's documentation for its service/characteristic UUIDs."
  )
}

export async function connectPrinter(): Promise<BluetoothRemoteGATTCharacteristic> {
  if (!isSupported()) {
    throw new BluetoothPrinterError(
      "This browser doesn't support Web Bluetooth. Use Chrome or Edge on desktop/Android."
    )
  }

  const device = await navigator.bluetooth.requestDevice({
    // acceptAllDevices with an empty optionalServices list would prevent us
    // from ever reaching the printer's services after connecting, so the
    // UART service (and a generic fallback filter) are declared up front.
    filters: [{ services: [UART_SERVICE] }, { namePrefix: "PX" }, { namePrefix: "Printer" }],
    optionalServices: [UART_SERVICE],
  }).catch(async () => {
    // Some printers don't advertise the service UUID in their scan
    // response, so the filtered request above can come back empty — retry
    // with acceptAllDevices so the operator can still pick it from the list.
    return navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [UART_SERVICE],
    })
  })

  if (device.id) localStorage.setItem(STORAGE_KEY, device.id)

  const server = await device.gatt?.connect()
  if (!server) throw new BluetoothPrinterError("Couldn't connect to the printer's Bluetooth service.")

  return findWriteCharacteristic(server)
}

/** Tries to silently reconnect to the last-paired printer without showing
 *  the device picker (only works for devices already granted permission in
 *  this browser profile). Returns null if none is available/reachable. */
export async function reconnectPrinter(): Promise<BluetoothRemoteGATTCharacteristic | null> {
  if (!isSupported() || !("getDevices" in navigator.bluetooth)) return null
  const lastId = localStorage.getItem(STORAGE_KEY)
  if (!lastId) return null

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const devices: BluetoothDevice[] = await (navigator.bluetooth as any).getDevices()
    const device = devices.find(d => d.id === lastId)
    if (!device) return null
    const server = await device.gatt?.connect()
    if (!server) return null
    return await findWriteCharacteristic(server)
  } catch {
    return null
  }
}

/** Sends raw bytes to the printer in small chunks with a short pause
 *  between writes — sending one giant write can overrun cheap printers'
 *  input buffers and drop data. */
export async function writeToPrinter(
  characteristic: BluetoothRemoteGATTCharacteristic,
  bytes: Uint8Array
) {
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    const chunk = bytes.slice(offset, offset + CHUNK_SIZE)
    if (characteristic.properties.writeWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk)
    } else {
      await characteristic.writeValue(chunk)
    }
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}
