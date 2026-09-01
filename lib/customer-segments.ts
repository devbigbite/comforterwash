/**
 * Customer segmentation — pure logic, no DB access.
 *
 * Segments are computed on the fly from a customer's booking history rather
 * than stored, so they're always current without a background job to keep
 * them in sync.
 *
 *   new      — 0 or 1 completed bookings, most recent within 30 days
 *   active   — booked within the last 45 days
 *   at_risk  — last booking 45-90 days ago
 *   dormant  — no booking in 90+ days (or never booked, but has a row —
 *              e.g. imported from a checkout attempt that never converted)
 */

export type Segment = "new" | "active" | "at_risk" | "dormant"

export interface SegmentInput {
  total_bookings: number
  last_booking_at: string | null
}

export function computeSegment(c: SegmentInput, now: Date = new Date()): Segment {
  if (!c.last_booking_at) return "dormant"
  const daysSince = (now.getTime() - new Date(c.last_booking_at).getTime()) / 86_400_000
  if (c.total_bookings <= 1 && daysSince <= 30) return "new"
  if (daysSince <= 45) return "active"
  if (daysSince <= 90) return "at_risk"
  return "dormant"
}

export const SEGMENT_LABELS: Record<Segment, string> = {
  new: "New",
  active: "Active",
  at_risk: "At Risk",
  dormant: "Dormant",
}

export const SEGMENT_COLORS: Record<Segment, string> = {
  new: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  at_risk: "bg-amber-100 text-amber-700",
  dormant: "bg-gray-200 text-gray-600",
}
