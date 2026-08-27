"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"
import { getComforterPromo } from "@/app/actions/settings"
import { getPricingConfig } from "@/app/actions/pricing"
import { computeComforterFacilityCostCents } from "@/lib/facility-comforter-cost"

export async function bulkAssignFacility(
  bookingIds: string[],
  facilityId: string,
): Promise<{ success: boolean; count: number; error?: string }> {
  await requireAdmin()

  if (!bookingIds.length || !facilityId) {
    return { success: false, count: 0, error: "No orders or facility selected" }
  }

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]

  const { error } = await supabase
    .from("bookings")
    .update({ assigned_facility_id: facilityId })
    .in("id", bookingIds)
    .eq("location_id", locationId)

  if (error) return { success: false, count: 0, error: error.message }

  // Comforter orders never go through weigh-in, so facility_cost_cents
  // wouldn't otherwise get set when a facility is assigned manually here —
  // see lib/facility-comforter-cost.ts. Backfill it now for any that are
  // still missing it, without touching orders that already have a cost
  // (e.g. from weigh-in, or a manual override).
  const { data: comforterBookings } = await supabase
    .from("bookings")
    .select("id, num_comforters, comforter_sizes")
    .in("id", bookingIds)
    .eq("location_id", locationId)
    .eq("service_type", "comforter_wash")
    .is("facility_cost_cents", null)

  if (comforterBookings?.length) {
    const [promoActive, pricing] = await Promise.all([getComforterPromo(), getPricingConfig()])
    const rates = {
      twinCents:  pricing.comforterFacilityTwinCents,
      fullCents:  pricing.comforterFacilityFullCents,
      queenCents: pricing.comforterFacilityQueenCents,
      kingCents:  pricing.comforterFacilityKingCents,
      promoCents: pricing.comforterFacilityPromoCents,
    }
    await Promise.all(
      comforterBookings.map(b =>
        supabase
          .from("bookings")
          .update({
            facility_cost_cents: computeComforterFacilityCostCents(
              b.comforter_sizes as string | null,
              b.num_comforters as number,
              promoActive,
              rates,
            ),
          })
          .eq("id", b.id),
      ),
    )
  }

  const events = bookingIds.map(bookingId => ({
    booking_id:  bookingId,
    event_type:  "facility_assigned",
    notes:       "Facility assigned in bulk by admin",
    created_by:  "admin",
  }))
  await supabase.from("order_events").insert(events)

  revalidatePath("/admin/routing")

  return { success: true, count: bookingIds.length }
}
