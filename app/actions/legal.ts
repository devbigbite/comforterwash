"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"

export type LegalSection = {
  id: string
  title: string
  content: string
  style?: "default" | "warning"
}

// ── Default content (fallback if DB has nothing yet) ─────────────────────────

const TERMS_DEFAULTS: LegalSection[] = [
  {
    id: "service-overview",
    title: "1. Service Overview",
    content: "ComforterWash Orlando provides pickup and delivery laundry services in the greater Orlando area, including Comforter Wash, Wash & Fold, and Wash Only. By booking a service, you agree to these terms in full.",
  },
  {
    id: "pricing-billing",
    title: "2. Pricing & Billing",
    content: "Wash & Fold orders are priced per pound based on the weight we receive at pickup. A pre-authorization hold is placed on your card at the time of booking to cover the estimated total. Your card is only charged the actual amount once your order has been weighed and processed.\n\nComforter Wash orders are priced by size (Twin, Full, Queen, King) as shown at the time of booking. The price shown is the final price — no weight adjustment applies.",
  },
  {
    id: "wet-items",
    title: "3. Wet or Damp Items",
    style: "warning",
    content: "We charge based on the weight of items as received at pickup. If your laundry arrives noticeably wet or damp — for example, towels or clothes that have not fully dried — our team will flag this on your order and may adjust the billed weight to reflect a reasonable dry estimate. We will always notify you before any adjustment is applied.\n\nTo avoid discrepancies, please ensure items are dry before pickup.",
  },
  {
    id: "items-not-accepted",
    title: "4. Items We Cannot Accept",
    content: "For the safety of our team and other customers' orders, we cannot process items that are contaminated with or contain:\n\n- Bodily fluids (blood, urine, feces, vomit)\n- Excessive pet hair or dander\n- Mold, mildew, or strong mildew odor\n- Bed bugs or other parasites\n- Poison ivy, oak, or sumac residue\n- Hazardous chemicals, paint, or solvents\n- Sharp objects (needles, broken glass, etc.)\n\nIf contaminated items are discovered after pickup, we will contact you and return them unprocessed. A pickup fee may apply.",
  },
  {
    id: "check-pockets",
    title: "5. Please Check Your Pockets",
    content: "Please remove all items from pockets before placing clothes in your laundry bag. We are not responsible for damage caused by items left in pockets — including pens, gum, lip balm, coins, lighters, or any other objects — to your garments or others in the same order. We will make our best effort to check pockets before washing, but this cannot be guaranteed.",
  },
  {
    id: "dry-clean",
    title: "6. Dry Clean & Special Care Items",
    content: "Items with care labels indicating dry-clean only, hand-wash only, or lay flat to dry should not be included in Wash & Fold orders. We wash all items in commercial washing machines with warm water and machine dry. We are not responsible for damage to items that require special handling not disclosed at the time of booking.",
  },
  {
    id: "stains",
    title: "7. Stains",
    content: "We treat visible stains as part of our standard Wash & Fold service, but we do not guarantee stain removal. Some stains — particularly those that have been set by heat or time — may not come out fully. We are not liable for stains that remain after washing. If you have items with known stains, please note them at booking so we can give them extra attention.",
  },
  {
    id: "pickup-delivery",
    title: "8. Pickup & Delivery",
    content: "We will do our best to arrive within your selected time window (9:00 AM – 1:00 PM or 3:00 PM – 7:00 PM). Delays due to traffic, weather, or high order volume may occur. We will notify you by text if we are running significantly outside your window.\n\nIf no one is available at pickup, please leave your items in an agreed location (front door, lobby, etc.) and note this in your booking. We are not responsible for items left unattended in unsecured locations.",
  },
  {
    id: "care-liability",
    title: "9. Care & Liability",
    content: "We take great care with every order. However, we are not responsible for damage to items that are not colorfast, pre-damaged, or require special handling not noted at booking.\n\nOur liability for any damaged item is limited to 3× the cleaning charge for that item, up to a maximum of $75 per item. We are not liable for consequential or incidental damages.",
  },
  {
    id: "lost-items",
    title: "10. Lost Items",
    content: "If you believe an item is missing from your returned order, you must notify us within 5 business days of delivery. Claims submitted after that window cannot be accepted. All valid claims must be submitted within 30 days of your delivery date. Our liability for any lost item is limited to 3× the cleaning charge for that item, up to a maximum of $75 per item.\n\nTo report a missing item, email us at hello@comforterwash.com with your order number and a description of the item.",
  },
  {
    id: "cancellations",
    title: "11. Cancellations",
    content: "You may cancel or reschedule your order at no charge up to 2 hours before your scheduled pickup window. Cancellations made after that point may be subject to a $10 cancellation fee to cover driver dispatch costs. Contact us at hello@comforterwash.com to cancel or reschedule.",
  },
  {
    id: "subscriptions",
    title: "12. Recurring Subscriptions",
    content: "Weekly and biweekly subscription plans continue automatically until cancelled. You may pause or cancel at any time through your account dashboard or by contacting us directly. Cancellations take effect at the end of the current billing cycle.",
  },
  {
    id: "sms-notifications",
    title: "13. SMS Notifications",
    content: "By providing your mobile number at booking, you consent to receive transactional SMS messages from ComforterWash Orlando related to your order — including pickup confirmation, driver on the way, and delivery confirmation. Message frequency varies by order. Standard message and data rates may apply. Reply STOP to opt out at any time. Reply HELP for help. We do not share your phone number with third parties for marketing purposes.",
  },
  {
    id: "contact",
    title: "14. Contact",
    content: "Questions about these terms? Reach us at hello@comforterwash.com.",
  },
]

const PRIVACY_DEFAULTS: LegalSection[] = [
  {
    id: "what-we-collect",
    title: "1. What We Collect",
    content: "When you book a service or create an account, we collect your name, email address, phone number, and service address. We also collect order details such as service type, pickup and delivery dates, and payment information (processed securely through Stripe — we never store your full card number).",
  },
  {
    id: "how-we-use",
    title: "2. How We Use It",
    content: "We use your information solely to fulfill your orders, send order confirmations and status updates via email and SMS, and improve our service. We do not sell, rent, or share your personal information with third parties for marketing purposes.",
  },
  {
    id: "sms-communications",
    title: "3. SMS Communications",
    content: "By providing your mobile phone number at booking, you consent to receive transactional SMS messages from ComforterWash Orlando. These messages are related to your order only — pickup confirmation, driver en route, and delivery confirmation.\n\n- Message frequency: Varies per order, typically 2–4 messages per pickup/delivery cycle.\n- To opt out: Reply STOP to any message at any time. You will receive one confirmation, then no further messages.\n- For help: Reply HELP or email us at hello@comforterwash.com.\n- Carrier rates: Standard message and data rates may apply depending on your carrier plan.\n- Data sharing: We do not share your phone number with third parties for marketing or promotional purposes.\n\nSMS messaging is handled through Twilio. Your number is used only to send the messages described above and is not sold or shared with advertisers.",
  },
  {
    id: "email-communications",
    title: "4. Email Communications",
    content: "We send transactional emails about your order (booking confirmation, pickup reminders, delivery updates). With your consent, we may also send occasional promotional emails. You can unsubscribe from promotional emails at any time using the unsubscribe link in any email. Transactional emails (order-related) are not affected by unsubscribing.",
  },
  {
    id: "data-storage",
    title: "5. Data Storage & Security",
    content: "Your data is stored securely using Supabase (PostgreSQL) with encrypted connections. Payment processing is handled by Stripe, which is PCI-DSS compliant. We apply industry-standard security practices to protect your information.",
  },
  {
    id: "third-party",
    title: "6. Third-Party Services",
    content: "We use the following third-party services to operate our business:\n\n- Stripe — payment processing\n- Supabase — database and authentication\n- Twilio — SMS notifications\n- Resend — email delivery\n- Shipday — driver dispatch and routing\n\nEach of these services has its own privacy policy governing how they handle data. We only share the minimum information necessary for each service to function.",
  },
  {
    id: "your-rights",
    title: "7. Your Rights",
    content: "You can request access to, correction of, or deletion of your personal data at any time by contacting us at hello@comforterwash.com. We will respond within 30 days.",
  },
  {
    id: "data-retention",
    title: "8. Data Retention",
    content: "We retain your order history and contact information for as long as your account is active and for up to 3 years afterward for legal and billing purposes. You may request deletion of your data at any time; deletion requests are processed within 30 days.",
  },
  {
    id: "cookies",
    title: "9. Cookies",
    content: "We use essential cookies only — for authentication sessions and basic site functionality. We do not use tracking or advertising cookies.",
  },
  {
    id: "contact",
    title: "10. Contact",
    content: "Questions about this policy? Email us at hello@comforterwash.com.",
  },
]

// ── Server actions ────────────────────────────────────────────────────────────

export async function getLegalPage(key: "terms" | "privacy"): Promise<LegalSection[]> {
  try {
    const [supabase, locationId] = [createAdminClient(), await getLocationId()]
    const { data } = await supabase
      .from("legal_pages")
      .select("sections")
      .eq("location_id", locationId)
      .eq("key", key)
      .single()
    if (data?.sections && Array.isArray(data.sections) && data.sections.length > 0) {
      return data.sections as LegalSection[]
    }
  } catch {
    // fall through to defaults
  }
  return key === "terms" ? TERMS_DEFAULTS : PRIVACY_DEFAULTS
}

export async function saveLegalPage(key: "terms" | "privacy", sections: LegalSection[]) {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { error } = await supabase
    .from("legal_pages")
    .upsert({ location_id: locationId, key, sections, updated_at: new Date().toISOString() }, { onConflict: "location_id,key" })
  if (error) throw error
  return { success: true }
}
