"use server"

// ── Recurring booking engine ─────────────────────────────────────────────────
// Generates the next booking automatically for:
//   1. Residential per-pickup subscriptions (weekly/biweekly) — subscriptions
//      table, subscription_type NOT 'monthly_plan'.
//   2. Commercial recurring accounts — commercial_accounts table with
//      recurring_enabled = true.
//
// Both sides work the same way: each row carries its own next_pickup_date.
// Once that date is within LOOKAHEAD_DAYS of "today", this engine creates the
// booking (via the normal createBooking() path — same dispatch/operator
// pipeline as every other order) and immediately advances next_pickup_date
// so a second cron run the same day never double-books.
//
// Billing is deferred to weigh-in, same as commercial pay-at-service orders:
// the booking is inserted with payment_status "pending_weight" and no
// pre-auth. The operator weigh-in flow (app/operator/order/[id]/page.tsx)
// then charges the saved card off-session — chargeCommercialAccountOrder()
// for commercial_account_id bookings, chargeSubscriptionOrder() for
// recurring_subscription_id bookings.
//
// Called by app/api/cron/recurring-bookings/route.ts, once daily.

import { createAdminClient } from "@/lib/supabase/admin"
import { createBooking } from "./bookings"

const LOOKAHEAD_DAYS = 3

const DAY_NUMS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}

function toDateOnly(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + days)
  return copy
}

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0]
}

/** Next calendar date on or after `from` that falls on the given weekday. */
function nextOccurrenceOnOrAfter(dayId: string | null, from: Date): Date {
  const base = toDateOnly(from)
  if (!dayId || !(dayId.toLowerCase() in DAY_NUMS)) return base
  const target = DAY_NUMS[dayId.toLowerCase()]
  const diff = (target - base.getDay() + 7) % 7
  return addDays(base, diff)
}

/** The pickup date for the cycle AFTER the one that was just created. */
function nextCyclePickupDate(currentPickup: Date, pickupDayId: string | null, frequency: string): Date {
  const intervalDays = frequency === "biweekly" ? 14 : 7
  const naive = addDays(currentPickup, intervalDays)
  // Snap back onto the correct weekday in case of any drift.
  return nextOccurrenceOnOrAfter(pickupDayId, naive)
}

export interface RecurringEngineResult {
  residentialCreated: number
  commercialCreated: number
  errors: string[]
}

export async function runRecurringEngine(): Promise<RecurringEngineResult> {
  const supabase = createAdminClient()
  const errors: string[] = []
  let residentialCreated = 0
  let commercialCreated = 0

  const cutoff = toISODate(addDays(toDateOnly(new Date()), LOOKAHEAD_DAYS))

  // ── 1. Residential per-pickup subscriptions ────────────────────────────────
  const { data: dueSubs } = await supabase
    .from("subscriptions")
    .select("id, location_id, customer_name, customer_email, customer_phone, customer_address, frequency, pickup_day_of_week, pickup_time_window, delivery_day_of_week, delivery_time_window, price_per_lb_cents, detergent, fabric_softener, oxi_clean, color_safe_bleach, next_pickup_date, status, subscription_type")
    .eq("status", "active")
    .in("frequency", ["weekly", "biweekly"]) // monthly plans use frequency: "monthly" — already excluded here, so no separate subscription_type filter is needed (a .neq on a nullable column would silently drop NULL rows)
    .not("next_pickup_date", "is", null)
    .lte("next_pickup_date", cutoff)

  for (const sub of dueSubs ?? []) {
    try {
      const pickupDate = new Date(`${sub.next_pickup_date}T12:00:00`)
      const deliveryDate = nextOccurrenceOnOrAfter(sub.delivery_day_of_week, addDays(pickupDate, 1))

      const extrasList = [
        sub.fabric_softener ? "Fabric Softener" : null,
        sub.oxi_clean ? "OxiClean" : null,
        sub.color_safe_bleach ? "Color-Safe Bleach" : null,
      ].filter(Boolean)

      const booking = await createBooking({
        customerName: sub.customer_name,
        customerEmail: sub.customer_email,
        customerPhone: sub.customer_phone,
        customerAddress: sub.customer_address,
        pickupDate: toISODate(pickupDate),
        pickupTimeWindow: sub.pickup_time_window || "9:00 AM - 12:00 PM",
        deliveryDate: toISODate(deliveryDate),
        deliveryTimeWindow: sub.delivery_time_window || "9:00 AM - 12:00 PM",
        numComforters: 1,
        numBags: 1,
        totalAmount: 0,
        serviceType: "wash_fold",
        pricePerLbCents: sub.price_per_lb_cents ?? undefined,
        detergent: sub.detergent ?? undefined,
        extras: extrasList.length ? extrasList.join(", ") : undefined,
        subscriptionFrequency: sub.frequency,
        paymentStatusOverride: "pending_weight",
        locationId: sub.location_id,
      })

      await supabase
        .from("bookings")
        .update({ recurring_subscription_id: sub.id })
        .eq("id", booking.id)

      const nextPickup = nextCyclePickupDate(pickupDate, sub.pickup_day_of_week, sub.frequency)
      await supabase
        .from("subscriptions")
        .update({ next_pickup_date: toISODate(nextPickup) })
        .eq("id", sub.id)

      residentialCreated++
    } catch (err) {
      const msg = `subscription ${sub.id}: ${err instanceof Error ? err.message : String(err)}`
      console.error("[recurring-engine]", msg)
      errors.push(msg)
    }
  }

  // ── 2. Commercial recurring accounts ───────────────────────────────────────
  const { data: dueAccounts } = await supabase
    .from("commercial_accounts")
    .select("id, location_id, business_name, contact_name, contact_email, contact_phone, address, frequency, pickup_day_of_week, pickup_time_window, delivery_day_of_week, delivery_time_window, num_bags, service_type, next_pickup_date, status, recurring_enabled, stripe_payment_method_id, access_instructions")
    .eq("status", "active")
    .eq("recurring_enabled", true)
    .not("next_pickup_date", "is", null)
    .lte("next_pickup_date", cutoff)

  for (const acct of dueAccounts ?? []) {
    try {
      if (!acct.stripe_payment_method_id) {
        errors.push(`commercial account ${acct.id} (${acct.business_name}): no card on file, skipped`)
        continue
      }

      const pickupDate = new Date(`${acct.next_pickup_date}T12:00:00`)
      const deliveryDate = nextOccurrenceOnOrAfter(acct.delivery_day_of_week, addDays(pickupDate, 1))

      const booking = await createBooking({
        customerName: acct.contact_name || acct.business_name,
        customerEmail: acct.contact_email || "",
        customerPhone: acct.contact_phone || "",
        customerAddress: acct.address || "",
        pickupDate: toISODate(pickupDate),
        pickupTimeWindow: acct.pickup_time_window || "9:00 AM - 12:00 PM",
        deliveryDate: toISODate(deliveryDate),
        deliveryTimeWindow: acct.delivery_time_window || "9:00 AM - 12:00 PM",
        numComforters: acct.num_bags ?? 1,
        numBags: acct.num_bags ?? 1,
        totalAmount: 0,
        serviceType: (acct.service_type as "wash_fold" | "wash_only" | "comforter_wash") ?? "wash_fold",
        commercialAccountId: acct.id,
        paymentStatusOverride: "pending_weight",
        locationId: acct.location_id,
        specialInstructions: acct.access_instructions ?? undefined,
      })

      const nextPickup = nextCyclePickupDate(pickupDate, acct.pickup_day_of_week, acct.frequency || "weekly")
      await supabase
        .from("commercial_accounts")
        .update({ next_pickup_date: toISODate(nextPickup) })
        .eq("id", acct.id)

      commercialCreated++
      void booking
    } catch (err) {
      const msg = `commercial account ${acct.id}: ${err instanceof Error ? err.message : String(err)}`
      console.error("[recurring-engine]", msg)
      errors.push(msg)
    }
  }

  return { residentialCreated, commercialCreated, errors }
}
