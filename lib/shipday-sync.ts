"use server"

// Safety net for the Shipday webhook — see app/api/shipday/webhook/[secret]/route.ts.
// That webhook is the intended real-time path, but it depends entirely on
// Shipday actually calling out to us; if Shipday's own delivery pipeline
// fails to fire (confirmed happening — a driver completed a delivery
// through the official Shipday Drive app and zero requests ever reached our
// endpoint, per Vercel logs), an order is stuck "out for delivery" forever
// with nothing in this codebase able to notice. This polls Shipday's own
// API instead of waiting to be told, so orders stop getting stuck
// regardless of whether Shipday's webhook delivery is reliable.
//
// Deliberately mirrors the webhook route's scope decision: only reconciles
// delivery completion (→ "delivered"). Pickup completion is intentionally
// left alone here too — Shipday has no concept of bag count/color
// stickers/weight, which our own driver app still has to collect.

import { createAdminClient } from "@/lib/supabase/admin"
import { getShipdayConfigForLocation } from "@/lib/location"
import { updateBookingStatus } from "@/app/actions/bookings"

const SHIPDAY_API_URL = "https://api.shipday.com"

interface ShipdayOrderDetails {
  orderId: number
  orderNumber: string
  orderStatus?: { incomplete: boolean; accepted: boolean; orderState: string }
  proofOfDelivery?: { imageUrls?: string[] } | null
  // Route position from Shipday's optimizer, if this order is part of a
  // route — see docs.shipday.com/reference/order-status-update-2. Riding
  // along on the same GET this function already makes rather than a
  // separate call, since this poll is a best-effort fallback, not the
  // primary path (the webhook's extractSequenceNumber is — see
  // app/api/shipday/webhook/[secret]/route.ts).
  order_sequence_number?: number | null
}

const DELIVERED_STATES = new Set(["ALREADY_DELIVERED"])

async function fetchShipdayOrder(orderNumber: string, apiKey: string): Promise<ShipdayOrderDetails | null> {
  try {
    const res = await fetch(`${SHIPDAY_API_URL}/orders/${encodeURIComponent(orderNumber)}`, {
      headers: { Authorization: `Basic ${apiKey}`, Accept: "application/json" },
    })
    if (!res.ok) {
      console.error(`[shipday-sync] GET /orders/${orderNumber} HTTP ${res.status}`)
      return null
    }
    const json = await res.json()
    // Docs describe this as returning an array of order-details objects.
    const order = Array.isArray(json) ? json[0] : json
    return order ?? null
  } catch (err) {
    console.error(`[shipday-sync] Network error fetching order ${orderNumber}:`, err)
    return null
  }
}

export interface ShipdaySyncResult {
  checked: number
  reconciled: number
  errors: string[]
}

// Reconciles every booking still sitting in "out_for_delivery" against
// Shipday's live order status. Bounded to the last 5 days so this stays
// cheap on every run and never goes trawling through old history.
export async function pollShipdayDeliveries(): Promise<ShipdaySyncResult> {
  // DISABLED as of the switch back to completing delivery entirely in our
  // own driver app (Shipday route-reordering removed the reason for the
  // split-app workflow this poll existed as a safety net for — see
  // app/api/shipday/webhook/[secret]/route.ts's matching change and
  // order-client.tsx's DELIVERY PHASE comment). Shipday is admin-only now,
  // for route ordering; nothing should ever be reconciled to "delivered"
  // from Shipday's own status, since that would skip the in-app delivery
  // photo our own flow now always requires. Left in place (rather than
  // deleted) in case a future need for a Shipday-side safety net returns —
  // this is also what was silently spamming the "bookings.updated_at does
  // not exist" DB error in production, so this early-return doubles as the
  // fix for that.
  return { checked: 0, reconciled: 0, errors: [] }
}

/* ── Original implementation, kept for reference / easy revert ──────────────
const supabase = createAdminClient()
const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()

const { data: stuck, error } = await supabase
  .from("bookings")
  .select("id, short_code, status, location_id, shipday_delivery_order_id, updated_at")
  .eq("status", "out_for_delivery")
  .not("shipday_delivery_order_id", "is", null)
  .gte("updated_at", fiveDaysAgo)

if (error) {
  console.error("[shipday-sync] DB error fetching stuck bookings:", error)
  return { checked: 0, reconciled: 0, errors: [error.message] }
}
if (!stuck || stuck.length === 0) {
  return { checked: 0, reconciled: 0, errors: [] }
}

const configCache = new Map<string, Awaited<ReturnType<typeof getShipdayConfigForLocation>>>()
async function configFor(locationId: string) {
  if (!configCache.has(locationId)) {
    configCache.set(locationId, await getShipdayConfigForLocation(locationId))
  }
  return configCache.get(locationId)!
}

let reconciled = 0
const errors: string[] = []

for (const booking of stuck) {
  if (!booking.location_id) continue
  const config = await configFor(booking.location_id)
  if (!config.apiKey) continue // tenant never set up Shipday — nothing to poll

  // Same orderNumber convention createShipdayOrder used at creation time —
  // see lib/shipday.ts's `${baseCode}D` for the delivery leg.
  const baseCode = booking.short_code ?? booking.id.slice(0, 6).toUpperCase()
  const orderNumber = `${baseCode}D`

  const order = await fetchShipdayOrder(orderNumber, config.apiKey)
  if (!order) continue

  if (order.order_sequence_number != null) {
    await supabase.from("bookings")
      .update({ shipday_delivery_sequence: order.order_sequence_number })
      .eq("id", booking.id)
  }

  const state = order.orderStatus?.orderState
  if (!state || !DELIVERED_STATES.has(state)) continue

  try {
    const podUrl = order.proofOfDelivery?.imageUrls?.[0]
    if (podUrl) {
      const { data: existingPhoto } = await supabase
        .from("order_events")
        .select("id")
        .eq("booking_id", booking.id)
        .eq("event_type", "photo_customer_delivery")
        .limit(1)
        .maybeSingle()
      if (!existingPhoto) {
        await supabase.from("order_events").insert({
          booking_id: booking.id,
          event_type: "photo_customer_delivery",
          photo_url: podUrl,
          notes: "Photo at customer — bags delivered (via Shipday, reconciled by poll)",
          created_by: "shipday_sync",
        })
      }
    }

    await supabase.from("order_events").insert({
      booking_id: booking.id,
      event_type: "shipday_webhook",
      notes: `Shipday delivery event: ${state} (reconciled by poll — webhook never arrived)`,
      created_by: "shipday_sync",
    })

    await updateBookingStatus(booking.id, "delivered")
    reconciled++
    console.log(`[shipday-sync] Booking ${booking.short_code ?? booking.id} reconciled to delivered via poll`)
  } catch (err) {
    errors.push(`${booking.id}: ${String(err)}`)
    console.error(`[shipday-sync] Failed to reconcile ${booking.id}:`, err)
  }
}

return { checked: stuck.length, reconciled, errors }
─────────────────────────────────────────────────────────────────────────── */
