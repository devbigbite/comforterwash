// ── Bag receipt text config ─────────────────────────────────────────────────
// Every phrase printed on a bag receipt (thermal printer via lib/escpos.ts,
// and the matching on-screen preview in app/operator/order/[id]/labels) used
// to be hardcoded in those two files. This makes them per-tenant settings
// instead, stored in the generic `settings` table (see app/actions/settings.ts
// getReceiptText/setReceiptText) so any tenant can change the wording from
// Content → Receipt Text without a code change.
//
// The three "notice" fields (welcome/returning/loyal) are keyed by which
// numbered order this is for the customer — 1st order gets the welcome
// message, 2nd gets the returning-customer coupon nudge, 3rd+ gets the
// general loyalty thank-you. Kept as three explicit slots rather than a list
// so the UI can label each one clearly instead of an ambiguous array.

export interface ReceiptText {
  welcomeTag: string
  welcomeText: string
  returningTag: string
  returningText: string
  loyalTag: string
  loyalText: string
  deliveryAddressLabel: string
  colorKeyLabel: string
  storageLabel: string
  washPrefsLabel: string
  dueDateLabel: string
  footerNote: string
}

export const DEFAULT_RECEIPT_TEXT: ReceiptText = {
  welcomeTag: "WELCOME GIFT INSIDE",
  welcomeText: "Welcome to the family — thank you for choosing us!",
  returningTag: "20% OFF COUPON INSIDE",
  returningText: "Thanks for coming back — enjoy 20% off your next order!",
  loyalTag: "LOYAL CUSTOMER",
  loyalText: "We appreciate your support — thank you!!!",
  deliveryAddressLabel: "Delivery Address",
  colorKeyLabel: "Color key sticker",
  storageLabel: "GOING TO STORAGE",
  washPrefsLabel: "Wash Preferences",
  dueDateLabel: "Deliver to customer by",
  footerNote: "Do not remove - Match sticker to bag",
}

/** Picks the right loyalty tag/text for a customer's Nth order. */
export function loyaltyNoticeFor(orderNumber: number, text: ReceiptText): { tag: string; text: string } {
  if (orderNumber === 1) return { tag: text.welcomeTag, text: text.welcomeText }
  if (orderNumber === 2) return { tag: text.returningTag, text: text.returningText }
  return { tag: text.loyalTag, text: text.loyalText }
}
