import type { SupabaseClient } from "@supabase/supabase-js"
import type { Phase } from "@/lib/facility-phases"

// ─── Reconciling two parallel tracking systems ────────────────────────────────
//
// This app tracks where an order physically is in two independent places:
//   1. bookings.status / order_bags.status — read by the Dispatch page
//      (Aerial View, Driver Routes, Operator Assignments) and the real
//      driver/operator PIN stations. Vocabulary: confirmed, picked_up,
//      at_facility, in_washer, in_dryer, folded, ready, at_warehouse,
//      ready_at_warehouse, out_for_delivery, delivered, cancelled.
//   2. bookings.phase — read by the separate /admin/facility floor board
//      (drag-and-drop columns with photo/color-key requirements).
//      Vocabulary: booked, at_storage, in_transit, intake, washing, drying,
//      folding, ready, staged, out_for_delivery, delivered, cancelled.
//
// These used to be written independently, so an order could be accurate on
// one board and stale/wrong on the other — e.g. an operator folding an order
// through the real PIN station would never move it on the facility board,
// and dragging a card on the facility board never touched the status the
// rest of the app (and the operator's own station) reads. The maps and
// helpers below keep both in sync at every write site, in both directions.

export const STATUS_TO_PHASE: Record<string, Phase | "booked" | "delivered" | "cancelled"> = {
  pending:             "booked",
  confirmed:           "booked",             // still at the customer's — no facility-board column for this, matches its default/hidden phase
  picked_up:           "in_transit",
  at_facility:         "intake",
  in_washer:           "washing",
  in_dryer:            "drying",
  folded:              "folding",
  ready:               "ready",
  at_warehouse:        "at_storage",
  ready_at_warehouse:  "staged",
  out_for_delivery:    "out_for_delivery",
  delivered:           "delivered",
  cancelled:           "cancelled",
}

export const PHASE_TO_STATUS: Record<string, string | null> = {
  booked:             null, // no facility-board column drags into "booked" — nothing to sync
  at_storage:         "at_warehouse",
  in_transit:         "picked_up",
  intake:             "at_facility",
  washing:            "in_washer",
  drying:             "in_dryer",
  folding:            "folded",
  ready:              "ready",
  staged:             "ready_at_warehouse",
  out_for_delivery:   "out_for_delivery",
  delivered:          "delivered",
  cancelled:          "cancelled",
}

// Call after any write to bookings.status (or order_bags.status) so the
// facility board's phase column reflects the move. Safe to call for any
// status string — unrecognized values are a no-op rather than throwing, so
// a status typo here never blocks the primary write that already happened.
export async function syncPhaseFromStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  bookingId: string,
  status: string,
  workerId?: string | null,
): Promise<void> {
  const phase = STATUS_TO_PHASE[status]
  if (!phase) return
  const { error } = await supabase
    .from("bookings")
    .update({ phase, phase_updated_at: new Date().toISOString(), phase_updated_by: workerId ?? null })
    .eq("id", bookingId)
  if (error) console.error("[order-status-sync] syncPhaseFromStatus failed:", error)
}

// Call after any write to bookings.phase (the facility board's drag-and-drop)
// so the status the rest of the app reads moves too. Also mirrors to
// order_bags.status when the mapped status is one of the granular
// processing-stage values, matching how the dispatch/operator flows keep
// both tables in step.
const BAG_STAGE_STATUSES = new Set([
  "picked_up", "at_facility", "in_washer", "in_dryer", "folded", "ready",
  "at_warehouse", "ready_at_warehouse", "out_for_delivery", "delivered", "cancelled",
])

export async function syncStatusFromPhase(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  bookingId: string,
  phase: string,
): Promise<void> {
  const status = PHASE_TO_STATUS[phase]
  if (!status) return
  const { error } = await supabase.from("bookings").update({ status }).eq("id", bookingId)
  if (error) console.error("[order-status-sync] syncStatusFromPhase (bookings) failed:", error)
  if (BAG_STAGE_STATUSES.has(status)) {
    const { error: bagErr } = await supabase.from("order_bags").update({ status }).eq("booking_id", bookingId)
    if (bagErr) console.error("[order-status-sync] syncStatusFromPhase (order_bags) failed:", bagErr)
  }
}
