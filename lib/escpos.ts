/**
 * Minimal ESC/POS command builder for generic 80mm thermal receipt
 * printers (the operator bag-receipts feature targets a "PX-90B" style
 * printer — USB + Bluetooth, no brand SDK). Builds raw byte arrays; the
 * actual transport (Web Bluetooth GATT writes) lives in bluetooth-printer.ts.
 *
 * Only ASCII text prints reliably on these printers' default code page —
 * there's no universal emoji/unicode support, so `text()` strips anything
 * outside printable ASCII rather than sending bytes that come out as
 * garbage characters or blank boxes on the paper.
 */

const ESC = 0x1b
const GS = 0x1d

export class ReceiptBuilder {
  private bytes: number[] = []

  private push(...b: number[]) {
    this.bytes.push(...b)
    return this
  }

  /** Printer reset — call once at the start of every receipt. */
  init() {
    return this.push(ESC, 0x40)
  }

  align(a: "left" | "center" | "right") {
    const n = a === "center" ? 1 : a === "right" ? 2 : 0
    return this.push(ESC, 0x61, n)
  }

  bold(on: boolean) {
    return this.push(ESC, 0x45, on ? 1 : 0)
  }

  /** width/height multiplier, 1 (normal) through 8 (max on most ESC/POS printers). */
  size(width: number, height: number) {
    const w = Math.min(Math.max(width, 1), 8) - 1
    const h = Math.min(Math.max(height, 1), 8) - 1
    return this.push(GS, 0x21, (w << 4) | h)
  }

  /** Strips non-ASCII (emoji, curly punctuation, etc.) — thermal printers
   *  have no reliable unicode support on their default code page. */
  private toAscii(str: string): string {
    return str
      .replace(/—/g, "-")
      .replace(/·/g, "*")
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/…/g, "...")
      // eslint-disable-next-line no-control-regex
      .replace(/[^\x00-\x7F]/g, "")
  }

  text(str: string) {
    const ascii = this.toAscii(str)
    for (let i = 0; i < ascii.length; i++) this.bytes.push(ascii.charCodeAt(i))
    return this
  }

  line(str = "") {
    return this.text(str).feed(1)
  }

  feed(lines = 1) {
    for (let i = 0; i < lines; i++) this.bytes.push(0x0a)
    return this
  }

  /** Dashed divider sized for an 80mm / 48-column receipt. */
  divider() {
    return this.line("-".repeat(32))
  }

  /** Feed a few blank lines then partial-cut. Call once at the end of each receipt. */
  cut() {
    this.feed(3)
    return this.push(GS, 0x56, 0x42, 0x00)
  }

  build(): Uint8Array {
    return new Uint8Array(this.bytes)
  }
}

export interface ReceiptData {
  orderCode: string
  bagNum: number
  totalBags: number
  bagCode: string | null
  serviceLabel: string
  loyaltyTag: string
  loyaltyText: string
  orderIdentifier: string
  address: string
  colorLabel: string | null
  goingToStorage: boolean
  prefsLine: string | null
  dueDate: string
}

/** Builds one full bag receipt as raw ESC/POS bytes, formatted to roughly
 *  mirror the on-screen/print-dialog layout (brand, bag count, big order
 *  code, loyalty notice, delivery address, color sticker call-out, storage
 *  flag, wash prefs, due date) — same content, ASCII-only. */
export function buildReceiptBytes(r: ReceiptData): Uint8Array {
  const b = new ReceiptBuilder()
  b.init()
    .align("center")
    .text("WASHFOLD ORLANDO").feed(1)
    .bold(true)
    .text(`BAG ${r.bagNum} / ${r.totalBags}`).feed(1)
    .bold(false)
    .size(2, 2)
    .text(r.orderCode).feed(1)
    .size(1, 1)

  if (r.bagCode) b.text(r.bagCode).feed(1)

  b.bold(true).text(r.serviceLabel).feed(1).bold(false)
  b.divider()

  b.bold(true).text(r.loyaltyTag).feed(1).bold(false)
  b.text(r.loyaltyText).feed(1)
  b.text(r.orderIdentifier).feed(1)
  b.feed(1)

  if (r.address) {
    b.align("left")
    b.bold(true).text("DELIVERY ADDRESS").feed(1).bold(false)
    b.text(r.address).feed(1)
    b.feed(1)
    b.align("center")
  }

  if (r.colorLabel) {
    b.bold(true).text("COLOR KEY STICKER: " + r.colorLabel.toUpperCase()).feed(1).bold(false)
    b.feed(1)
  }

  if (r.goingToStorage) {
    b.bold(true).text("** APPLY YELLOW MARKER STICKER **").feed(1)
      .text("GOING TO STORAGE").feed(1).bold(false)
    b.feed(1)
  }

  if (r.prefsLine) {
    b.align("left")
    b.bold(true).text("WASH PREFERENCES").feed(1).bold(false)
    b.text(r.prefsLine).feed(1)
    b.feed(1)
    b.align("center")
  }

  b.bold(true).text(r.dueDate).feed(1).bold(false)
  b.text("Deliver to customer by").feed(1)
  b.feed(1)
  b.text("Do not remove - Match sticker to bag").feed(1)

  b.cut()
  return b.build()
}
