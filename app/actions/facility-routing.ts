"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export async function bulkAssignFacility(
  bookingIds: string[],
  facilityId: string,
): Promise<{ success: boolean; count: number; error?: string }> {
  if (!bookingIds.length || !facilityId) {
    return { success: false, count: 0, error: "No orders or facility selected" }
  }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from("bookings")
    .update({ assigned_facility_id: facilityId })
    .in("id", bookingIds)

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
