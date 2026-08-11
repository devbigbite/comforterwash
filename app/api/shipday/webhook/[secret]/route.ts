import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { updateBookingStatus } from "@/app/actions/bookings"

// ── Shipday → our app status sync ───────────────────────────────────────────
// Solves the "two apps disagree" problem: a driver marking a delivery
// complete in Shipday previously left our own booking status frozen
// (still "ready"/"out_for_delivery") since nothing ever told our app it
// happened — see Gabriela's order (977763) getting stuck in Aerial View /
// Driver Routes indefinitely despite being physically delivered.
//
// Each tenant pastes their own unique URL (this route + their
// shipday_webhook_secret) into their own Shipday account's webhook settings,
// so this is fully tenant-isolated — a secret from tenant A can't be used to
// post fake events against tenant B's orders.
//
// Scope, per explicit decision:
//   - Delivery marked complete  → auto-mark our booking "delivered" (same
//     effect as the driver tapping "Confirm Delivered" in our own app —
//     fires the normal customer delivered SMS via updateBookingStatus).
//   - Pickup marked complete    → log only, no status change. Shipday has no
//     concept of bag count, color-key stickers, or weight — those are
//     required fields our own driver app collects, so advancing status from
//     a pickup-side webhook alone would silently skip them.
//   - Everything else (assigned, on the way, failed, etc.) → logged to the
//     order timeline for visibility only.
//
// Every webhook call is logged verbatim (truncated) to order_events
// regardless of whether it maps to a known booking or field we act on, so a
// misconfigured or unexpected payload shape is visible on the order/timeline
// rather than silently swallowed — this exact silent-failure pattern already
// bit this app once this session (the confirmDropoff unchecked-update bug).

// Per Shipday's actual webhook docs (docs.shipday.com/reference/order-status-update-2),
// the payload is snake_case: { timestamp, event, order_status, order: { id, order_number, ... }, ... }.
// Read defensively anyway — Shipday's older integrations/docs used camelCase
// (orderId/orderNumber), and this endpoint shouldn't hard-fail if a field
// comes through differently than expected.
function extractOrderId(body: Record<string, unknown>): number | null {
  const order = (body.order as Record<string, unknown> | undefined) ?? body
  const raw = order.id ?? order.orderId ?? body.orderId ?? body.id
  const n = typeof raw === "string" ? parseInt(raw, 10) : raw
  return typeof n === "number" && !isNaN(n) ? n : null
}

function extractOrderNumber(body: Record<string, unknown>): string | null {
  const order = (body.order as Record<string, unknown> | undefined) ?? body
  const raw = order.order_number ?? order.orderNumber ?? body.order_number ?? body.orderNumber
  return typeof raw === "string" ? raw : null
}

// "event" is the primary field Shipday sends; "order_status" is a secondary
// field on the same payload reflecting the order's status after the event
// (e.g. event=ORDER_PIKEDUP, order_status=PICKED_UP) — checked as a fallback
// in case an integration only sends one of the two.
function extractEventType(body: Record<string, unknown>): string {
  const raw = body.event ?? body.order_status ?? body.eventType ?? body.status ?? body.orderStatus
  return typeof raw === "string" ? raw.toUpperCase() : "UNKNOWN"
}

// Shipday's own proof-of-delivery photo — sent as order.podUrls, an array of
// URL strings. If a driver completes delivery through Shipday instead of our
// own app, that photo would otherwise stay trapped in Shipday and never
// reach the customer's tracking page, since our own delivery flow requires
// its own photo_customer_delivery step that this driver never went through.
// Pulling the first podUrl through here means the customer-facing tracking
// page shows a delivery photo either way, regardless of which app the
// driver actually used.
function extractPodUrl(body: Record<string, unknown>): string | null {
  const order = (body.order as Record<string, unknown> | undefined) ?? body
  const raw = order.podUrls ?? order.pod_urls
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0]
  return null
}

// Real enum values per Shipday's docs — note "ORDER_PIKEDUP" (their typo,
// not "PICKED_UP") is the actual event name for a completed pickup.
const DELIVERY_COMPLETE_EVENTS = new Set([
  "ORDER_COMPLETED", "ALREADY_DELIVERED",
])
const PICKUP_COMPLETE_EVENTS = new Set([
  "ORDER_PIKEDUP", "PICKED_UP", "READY_TO_DELIVER",
])

export async function POST(req: NextRequest, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params
  if (!secret) return NextResponse.json({ error: "Missing secret" }, { status: 401 })

  const supabase = createAdminClient()

  const { data: location } = await supabase
    .from("locations")
    .select("id")
    .eq("shipday_webhook_secret", secret)
    .maybeSingle()

  if (!location) {
    console.error("[shipday-webhook] Unknown secret — rejecting")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const shipdayOrderId = extractOrderId(body)
  const orderNumber = extractOrderNumber(body)
  const eventType = extractEventType(body)

  if (!shipdayOrderId) {
    console.error("[shipday-webhook] Could not extract an order id from payload:", JSON.stringify(body).slice(0, 500))
    return NextResponse.json({ error: "No order id in payload" }, { status: 200 }) // 200 so Shipday doesn't retry-storm on a shape we can't parse
  }

  // Every one of this tenant's bookings created a pickup order AND a
  // delivery order in Shipday (see lib/shipday.ts createShipdayOrder) —
  // match on whichever leg this event is actually about.
  const { data: pickupMatch } = await supabase
    .from("bookings")
    .select("id, short_code, status, location_id")
    .eq("location_id", location.id)
    .eq("shipday_pickup_order_id", shipdayOrderId)
    .maybeSingle()

  const { data: deliveryMatch } = pickupMatch ? { data: null } : await supabase
    .from("bookings")
    .select("id, short_code, status, location_id")
    .eq("location_id", location.id)
    .eq("shipday_delivery_order_id", shipdayOrderId)
    .maybeSingle()

  const booking = pickupMatch ?? deliveryMatch
  const leg = pickupMatch ? "pickup" : deliveryMatch ? "delivery" : null

  if (!booking) {
    // Not necessarily an error — could be a transport-run order (warehouse↔
    // facility legs also go through Shipday, see createShipdayRunOrder) which
    // has no matching booking row by design. Log and move on.
    console.log(`[shipday-webhook] No booking found for Shipday order ${shipdayOrderId} (${orderNumber ?? "no order#"}), event=${eventType}`)
    return NextResponse.json({ ok: true, matched: false })
  }

  // Always log the raw event — visible on the order timeline even for event
  // types we don't act on, so nothing from Shipday is silently dropped.
  await supabase.from("order_events").insert({
    booking_id: booking.id,
    event_type: "shipday_webhook",
    notes: `Shipday ${leg} event: ${eventType}${orderNumber ? ` (${orderNumber})` : ""}`,
    created_by: "shipday",
  })

  if (leg === "delivery" && DELIVERY_COMPLETE_EVENTS.has(eventType)) {
    const podUrl = extractPodUrl(body)
    if (podUrl) {
      // Only pull it in if we don't already have one from our own driver app
      // (e.g. a driver who took the photo in our app first, then also
      // completed the order in Shipday) — first photo wins, never overwrite.
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
          notes: "Photo at customer — bags delivered (via Shipday)",
          created_by: "shipday",
        })
      }
    }
    if (booking.status !== "delivered") {
      try {
        await updateBookingStatus(booking.id, "delivered")
        console.log(`[shipday-webhook] Booking ${booking.short_code ?? booking.id} auto-marked delivered from Shipday`)
      } catch (err) {
        console.error(`[shipday-webhook] Failed to mark ${booking.id} delivered:`, err)
        await supabase.from("order_events").insert({
          booking_id: booking.id,
          event_type: "shipday_webhook",
          notes: `⚠ Shipday reported delivery complete but auto-marking delivered failed: ${String(err)}`,
          created_by: "shipday",
        })
      }
    }
  } else if (leg === "pickup" && PICKUP_COMPLETE_EVENTS.has(eventType)) {
    // Log-only by design — see file header. Bag count/color/weight still
    // require the driver's own app.
    console.log(`[shipday-webhook] Pickup completed in Shipday for ${booking.short_code ?? booking.id} — no status change (requires driver app)`)
  }

  return NextResponse.json({ ok: true, matched: true, bookingId: booking.id, leg, eventType })
}

// Shipday's webhook config UI typically does a GET/ping to verify a URL
// before saving it — respond 200 rather than 405 so setup doesn't fail at
// that step.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params
  const supabase = createAdminClient()
  const { data: location } = await supabase
    .from("locations")
    .select("id")
    .eq("shipday_webhook_secret", secret)
    .maybeSingle()
  if (!location) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ ok: true })
}
