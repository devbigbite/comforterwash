"use server"

import { createAdminClient } from "@/lib/supabase/admin"

export type FaqCategory = "general" | "comforter_wash" | "wash_fold"

export type FaqItem = {
  id: string
  category: FaqCategory
  question: string
  answer: string
  sort_order: number
  active: boolean
}

// ── Default content (shown if DB is empty) ────────────────────────────────────

const DEFAULTS: FaqItem[] = [
  // ── General ──────────────────────────────────────────────────────────────
  {
    id: "gen-1", category: "general", sort_order: 1, active: true,
    question: "How does the service work?",
    answer: "It's simple: book online, leave your laundry outside, and we take care of the rest. Our driver picks up your bag during your chosen window, we wash and fold everything at our facility, and return it to your door — typically the next day. You'll receive text updates at every step.",
  },
  {
    id: "gen-2", category: "general", sort_order: 2, active: true,
    question: "What areas do you serve?",
    answer: "We serve the greater Orlando area. Enter your zip code at the start of the booking to confirm availability in your neighborhood. If you're outside our current service area, email us at hello@comforterwash.com and we'll add you to the waitlist.",
  },
  {
    id: "gen-3", category: "general", sort_order: 3, active: true,
    question: "What are your pickup and delivery windows?",
    answer: "We offer two daily windows: Morning (9:00 AM – 1:00 PM) and Afternoon (3:00 PM – 7:00 PM). You choose a pickup window and a delivery window when you book. We'll text you when your driver is on the way.",
  },
  {
    id: "gen-4", category: "general", sort_order: 4, active: true,
    question: "What do I put my laundry in?",
    answer: "Any bag works — trash bags, tote bags, laundry bags, whatever you have. You don't need to label anything; our driver will tag your order at pickup. The only thing we can't accept is loose items or open laundry baskets.",
  },
  {
    id: "gen-5", category: "general", sort_order: 5, active: true,
    question: "Do you check pockets?",
    answer: "We do our best, but with high order volume we cannot guarantee every pocket is checked before washing. Please remove all items from pockets before sending your laundry — pens, chapstick, gum, coins, lighters. We are not responsible for damage to your garments or others in your order caused by items left in pockets.",
  },
  {
    id: "gen-6", category: "general", sort_order: 6, active: true,
    question: "Can I leave special instructions?",
    answer: "Yes. You can add a note in the booking form for one-time instructions. For permanent preferences on recurring orders — detergent type, fabric softener, special care items — email us at hello@comforterwash.com and we'll add it to your account.",
  },
  {
    id: "gen-7", category: "general", sort_order: 7, active: true,
    question: "Do you offer dry cleaning?",
    answer: "No. We specialize in machine-washable items only. Do not include dry-clean only garments in your order — we are not responsible for damage to items with dry-clean only care labels.",
  },
  {
    id: "gen-8", category: "general", sort_order: 8, active: true,
    question: "How do I cancel or reschedule?",
    answer: "You can cancel or reschedule at no charge up to 2 hours before your pickup window. After that, a $10 cancellation fee may apply to cover driver dispatch costs. Email us at hello@comforterwash.com or log into your account to make changes.",
  },
  {
    id: "gen-9", category: "general", sort_order: 9, active: true,
    question: "What if I forget to set out my laundry?",
    answer: "It happens! A $10 missed pickup fee applies to compensate your driver's time. Contact us at hello@comforterwash.com and we'll reschedule your pickup for the next available route day.",
  },
  {
    id: "gen-10", category: "general", sort_order: 10, active: true,
    question: "How do I contact you?",
    answer: "Email us at hello@comforterwash.com. We respond within a few hours during business hours. For urgent issues related to an active order, you can also reach us through your order confirmation message.",
  },

  // ── Comforter Washing ─────────────────────────────────────────────────────
  {
    id: "cw-1", category: "comforter_wash", sort_order: 1, active: true,
    question: "What sizes do you wash?",
    answer: "We wash Twin, Full, Queen, and King size comforters. Select the size at booking — pricing is per item by size, shown clearly at checkout.",
  },
  {
    id: "cw-2", category: "comforter_wash", sort_order: 2, active: true,
    question: "How is pricing calculated?",
    answer: "Comforters are charged per item by size, not by weight. The price you see at checkout is the exact amount you'll pay — no surprises after pickup.",
  },
  {
    id: "cw-3", category: "comforter_wash", sort_order: 3, active: true,
    question: "How are comforters washed and dried?",
    answer: "Each comforter is washed individually in a commercial-grade oversized machine and dried thoroughly on a low-heat cycle. We never rush the drying process — large bedding takes time to dry properly, and we make sure it's fully dry before returning it to you.",
  },
  {
    id: "cw-4", category: "comforter_wash", sort_order: 4, active: true,
    question: "Do you wash duvets, quilts, or blankets?",
    answer: "We specialize in comforters. If you have a duvet insert, thick blanket, or other large bedding item, email us at hello@comforterwash.com before booking to confirm we can accommodate it.",
  },
  {
    id: "cw-5", category: "comforter_wash", sort_order: 5, active: true,
    question: "What if my comforter arrives damp or wet?",
    answer: "We charge based on the weight received at pickup. If your comforter arrives noticeably wet or damp, our team will flag it and may adjust the order to reflect a fair dry estimate. We'll always notify you before any adjustment is applied. Please ensure your comforter is dry before pickup.",
  },
  {
    id: "cw-6", category: "comforter_wash", sort_order: 6, active: true,
    question: "How quickly will I get it back?",
    answer: "Comforters booked today are returned the next day within your selected delivery window. Turnaround is typically 24 hours.",
  },
  {
    id: "cw-7", category: "comforter_wash", sort_order: 7, active: true,
    question: "Can I send pillows?",
    answer: "At this time we do not wash pillows. They require a specialized cleaning process that we are not currently set up to provide.",
  },
  {
    id: "cw-8", category: "comforter_wash", sort_order: 8, active: true,
    question: "Do you guarantee stain removal?",
    answer: "We treat visible stains as part of our comforter wash service, but we cannot guarantee full removal. Deep-set, old, or heat-set stains may not come out completely. If you have a heavily stained comforter, note it in your booking and we'll give it extra attention.",
  },

  // ── Wash & Fold ───────────────────────────────────────────────────────────
  {
    id: "wf-1", category: "wash_fold", sort_order: 1, active: true,
    question: "How much does Wash & Fold cost?",
    answer: "Wash & Fold is priced per pound based on the weight we receive at pickup. A pre-authorization hold is placed on your card at booking for the estimated total. You are only charged the actual amount once your order is weighed. See current pricing at checkout.",
  },
  {
    id: "wf-2", category: "wash_fold", sort_order: 2, active: true,
    question: "Is there a minimum order?",
    answer: "Yes, there is a minimum order for Wash & Fold. The minimum is displayed at checkout. Orders below the minimum are charged at the minimum rate.",
  },
  {
    id: "wf-3", category: "wash_fold", sort_order: 3, active: true,
    question: "Do I need to sort my clothes?",
    answer: "No sorting needed — that's our job. We separate darks, lights, and colors before washing. If you have specific preferences (e.g., all in cold water together), note it in your order instructions.",
  },
  {
    id: "wf-4", category: "wash_fold", sort_order: 4, active: true,
    question: "What detergent do you use?",
    answer: "We offer two standard options at checkout: a fresh-scented detergent or an unscented, fragrance-free (hypoallergenic) option. You can also add OxiClean for whites, fabric softener, or color-safe bleach as add-ons when booking.",
  },
  {
    id: "wf-5", category: "wash_fold", sort_order: 5, active: true,
    question: "Can you remove stains?",
    answer: "We treat visible stains as part of our standard Wash & Fold service. For best results, note stained items in your order instructions. We cannot guarantee full removal, especially for set-in or heat-set stains. If you pretreat before pickup, it increases the chances of success.",
  },
  {
    id: "wf-6", category: "wash_fold", sort_order: 6, active: true,
    question: "Do you read clothing care labels?",
    answer: "We are not able to read individual care labels for each garment. All items are washed in warm water and machine dried at medium heat. If you have delicates, dry-clean only, or hand-wash only items, please keep them out of your Wash & Fold order or bag them separately with clear written instructions.",
  },
  {
    id: "wf-7", category: "wash_fold", sort_order: 7, active: true,
    question: "What items can't be included?",
    answer: "Please do not include: dry-clean only or hand-wash only items, shoes, handbags, hats, pillows, curtains, or items contaminated with bodily fluids, mold, mildew, bed bugs, pet hair, or hazardous chemicals. See our Terms of Service for the full list.",
  },
  {
    id: "wf-8", category: "wash_fold", sort_order: 8, active: true,
    question: "When will I get my clothes back?",
    answer: "Your order is returned the next day within your selected delivery window — typically within 24 hours of pickup.",
  },
  {
    id: "wf-9", category: "wash_fold", sort_order: 9, active: true,
    question: "How are my clothes packaged for return?",
    answer: "Clothes are neatly folded and returned in the same bag(s) they were picked up in. If you included a separate bag for delicates or special-care items, those are returned in their original bag.",
  },
  {
    id: "wf-10", category: "wash_fold", sort_order: 10, active: true,
    question: "What about recurring Wash & Fold subscriptions?",
    answer: "We offer weekly and biweekly recurring Wash & Fold plans at a slightly reduced per-pound rate. Recurring customers get priority scheduling and a fixed route day. You can pause or cancel anytime through your account or by emailing us.",
  },
]

// ── Server actions ────────────────────────────────────────────────────────────

export async function getFaqItems(): Promise<FaqItem[]> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("faq_items")
      .select("*")
      .order("category")
      .order("sort_order")
    if (!error && data && data.length > 0) return data as FaqItem[]
  } catch {
    // fall through to defaults
  }
  return DEFAULTS
}

export async function upsertFaqItems(category: FaqCategory, items: Omit<FaqItem, "created_at">[]) {
  const supabase = createAdminClient()

  // Delete existing items for this category
  await supabase.from("faq_items").delete().eq("category", category)

  if (items.length === 0) return { success: true }

  // Re-insert with updated sort_order
  const rows = items.map((item, i) => ({
    id: item.id.startsWith("gen-") || item.id.startsWith("cw-") || item.id.startsWith("wf-")
      ? undefined  // let DB generate UUID for default items being persisted for first time
      : item.id,
    category: item.category,
    question: item.question,
    answer: item.answer,
    sort_order: i,
    active: item.active,
  }))

  const { error } = await supabase.from("faq_items").insert(rows)
  if (error) throw error
  return { success: true }
}
