"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"

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
