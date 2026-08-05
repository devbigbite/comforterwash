// Minimal ambient Web Serial types — no @types package installed, and this
// API isn't part of TypeScript's built-in "dom" lib. Only covers what
// lib/serial-printer.ts actually uses.

interface SerialPortOpenOptions {
  baudRate: number
}

interface SerialPort {
  writable: WritableStream<Uint8Array> | null
  readable: ReadableStream<Uint8Array> | null
  open(options: SerialPortOpenOptions): Promise<void>
  close(): Promise<void>
}

interface SerialRequestOptions {
  filters?: { usbVendorId?: number; usbProductId?: number }[]
}

interface Serial {
  requestPort(options?: SerialRequestOptions): Promise<SerialPort>
  getPorts(): Promise<SerialPort[]>
}

interface Navigator {
  serial: Serial
}
