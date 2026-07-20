"use server"

import { createAdminClient } from "@/lib/supabase/admin"

export interface UnprintedOrder {
  id: string
  short_code: string | null
  bag_count: number
  hold_at_facility: boolean
  delivery_date: string | null
}

/**
 * Orders that are finished (Floor/Storage decision made — the only way
 * hold_at_facility gets set is from that decision, which only appears once
 * the operator has marked the order Ready) and haven't had their bag
 * receipts printed yet. Powers the shared print station's queue.
 */
export async function getUnprintedOrders(): Promise<UnprintedOrder[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("bookings")
    .select("id, short_code, output_bags, num_bags, hold_at_facility, delivery_date")
    .not("hold_at_facility", "is", null)
    .is("receipts_printed_at", null)
    .not("status", "in", '("delivered","cancelled")')
    .order("delivery_date", { ascending: true })

  return (data ?? []).map(b => ({
    id: b.id,
    short_code: b.short_code,
    bag_count: b.output_bags ?? b.num_bags ?? 1,
    hold_at_facility: b.hold_at_facility as boolean,
    delivery_date: b.delivery_date,
  }))
}

/**
 * Looks up a booking id by short code (exact) or by id prefix — used by the
 * driver app's manual order lookup. Server-side/admin-client so it doesn't
 * depend on any public RLS read access to bookings.
 */
export async function findBookingForDriverLookup(cleanedDigits: string): Promise<{ id: string } | null> {
  const supabase = createAdminClient()
  const { data: byCode } = await supabase
    .from("bookings").select("id").eq("short_code", cleanedDigits).maybeSingle()
  if (byCode) return byCode
  const { data: byId } = await supabase
    .from("bookings").select("id").ilike("id", `${cleanedDigits}%`).limit(1).maybeSingle()
  return byId ?? null
}

export async function markReceiptsPrinted(bookingId: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from("bookings").update({ receipts_printed_at: new Date().toISOString() }).eq("id", bookingId)
}

export interface PrintedOrder extends UnprintedOrder {
  receipts_printed_at: string
}

/** Recently-printed orders, most recent first — for the station's reprint list. */
export async function getPrintedOrders(): Promise<PrintedOrder[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("bookings")
    .select("id, short_code, output_bags, num_bags, hold_at_facility, delivery_date, receipts_printed_at")
    .not("receipts_printed_at", "is", null)
    .order("receipts_printed_at", { ascending: false })
    .limit(50)

  return (data ?? []).map(b => ({
    id: b.id,
    short_code: b.short_code,
    bag_count: b.output_bags ?? b.num_bags ?? 1,
    hold_at_facility: b.hold_at_facility as boolean,
    delivery_date: b.delivery_date,
    receipts_printed_at: b.receipts_printed_at as string,
  }))
}

export interface OperatorOrder {
  id: string
  short_code: string | null
  customer_name: string
  service_type: string
  status: string
  bags_scanned: number
  bags_total: number
  effective_status: string  // derived from most advanced bag status, or booking status
  assigned_facility_id: string | null
  assigned_operator_id: string | null
  washer_label: string | null
  dryer_label: string | null
  actual_weight_lbs: number | null
}

const STATUS_ORDER = ["at_facility", "in_washer", "in_dryer", "folded", "ready"]

/**
 * Returns the processing queue for a specific operator.
 *
 * Orders only show up here once dispatch has assigned them to this worker
 * (bookings.assigned_operator_id, set from Admin -> Dispatch -> Operator
 * Assignments). The "owner" sentinel worker sees every in-progress order,
 * matching the oversight access owners get elsewhere in the app.
 */
export async function getOperatorQueue(workerId: string): Promise<OperatorOrder[]> {
  if (!workerId) return []

  const supabase = createAdminClient()

  // Fetch active bookings (not partner_attendant), scoped to this operator
  // unless they're the owner (who can see the whole facility queue).
  let query = supabase
    .from("bookings")
    .select("id, short_code, customer_name, service_type, status, num_bags, facility_processing_mode, assigned_facility_id, assigned_operator_id, washer_label, dryer_label, actual_weight_lbs")
    .in("status", ["in_progress"])
    .or("facility_processing_mode.is.null,facility_processing_mode.neq.partner_attendant")

  if (workerId !== "owner") {
    query = query.eq("assigned_operator_id", workerId)
  }

  const { data: bookings } = await query

  if (!bookings?.length) return []

  // Fetch all bags for these bookings using admin client (bypasses RLS)
  const bookingIds = bookings.map(b => b.id)
  const { data: bags } = await supabase
    .from("order_bags")
    .select("booking_id, status")
    .in("booking_id", bookingIds)

  return bookings.map(b => {
    const orderBags   = (bags ?? []).filter(bag => bag.booking_id === b.id)
    const bagStatuses = orderBags.map(bag => bag.status)

    // Most advanced bag status (furthest along in the pipeline)
    const mostAdv = bagStatuses.length > 0
      ? [...bagStatuses].sort((a, z) => STATUS_ORDER.indexOf(z) - STATUS_ORDER.indexOf(a))[0]
      : null

    // Only count bags that are actively in processing stations
    const scanned = orderBags.filter(bag =>
      ["at_facility", "in_washer", "in_dryer", "folded", "ready"].includes(bag.status)
    ).length

    return {
      id:                   b.id,
      short_code:           b.short_code ?? null,
      customer_name:        b.customer_name,
      service_type:         b.service_type,
      status:               b.status,
      bags_scanned:         scanned,
      bags_total:           b.num_bags ?? orderBags.length,
      effective_status:     mostAdv ?? b.status,  // fall back to booking status if no bags
      assigned_facility_id: b.assigned_facility_id ?? null,
      assigned_operator_id: b.assigned_operator_id ?? null,
      washer_label:         b.washer_label ?? null,
      dryer_label:          b.dryer_label  ?? null,
      actual_weight_lbs:    b.actual_weight_lbs ?? null,
    }
  })
}
