"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  patchShipdayOrder,
  deleteShipdayOrder,
  assignShipdayDriver,
} from "@/lib/shipday"

/** Fetch the stored Shipday IDs for a booking. */
async function getShipdayIds(bookingId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("bookings")
    .select("shipday_pickup_order_id, shipday_delivery_order_id")
    .eq("id", bookingId)
    .single()

  if (error || !data) {
    console.error(`[shipday-actions] Could not fetch IDs for booking ${bookingId}:`, error?.message)
    return { pickupId: null, deliveryId: null }
  }

  return {
    pickupId: data.shipday_pickup_order_id as number | null,
    deliveryId: data.shipday_delivery_order_id as number | null,
  }
}

/**
 * Reschedule pickup in Shipday when admin changes the pickup date or time window.
 * Call this whenever pickup_date or pickup_time_window changes on a booking.
 */
export async function reschedulePickup(
  bookingId: string,
  newPickupDate: string,         // YYYY-MM-DD
  newPickupTimeWindow: string    // "9am-1pm" | "3pm-7pm"
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient()

  // Update DB first
  const { error: dbError } = await supabase
    .from("bookings")
    .update({ pickup_date: newPickupDate, pickup_time_window: newPickupTimeWindow })
    .eq("id", bookingId)

  if (dbError) return { ok: false, error: dbError.message }

  // Push to Shipday
  const { pickupId } = await getShipdayIds(bookingId)
  if (pickupId) {
    await patchShipdayOrder(pickupId, {
      pickupDate: newPickupDate,
      pickupTimeWindow: newPickupTimeWindow,
    })
  } else {
    console.warn(`[shipday-actions] No Shipday pickup ID for booking ${bookingId} — DB updated but Shipday not patched`)
  }

  return { ok: true }
}

/**
 * Reschedule delivery in Shipday when admin changes the delivery date or time window.
 */
export async function rescheduleDelivery(
  bookingId: string,
  newDeliveryDate: string,
  newDeliveryTimeWindow: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient()

  const { error: dbError } = await supabase
    .from("bookings")
    .update({ delivery_date: newDeliveryDate, delivery_time_window: newDeliveryTimeWindow })
    .eq("id", bookingId)

  if (dbError) return { ok: false, error: dbError.message }

  const { deliveryId } = await getShipdayIds(bookingId)
  if (deliveryId) {
    await patchShipdayOrder(deliveryId, {
      pickupDate: newDeliveryDate,
      pickupTimeWindow: newDeliveryTimeWindow,
    })
  } else {
    console.warn(`[shipday-actions] No Shipday delivery ID for booking ${bookingId} — DB updated but Shipday not patched`)
  }

  return { ok: true }
}

/**
 * Switch the drop-off address for a pickup order (e.g. 1A→1B route change).
 * Only patches the pickup Shipday order's pickup address (the "restaurant address" from Shipday's
 * perspective is the facility; the customer address is the customer's home).
 *
 * Note: Shipday's customerAddress field is the delivery destination — for a pickup order
 * the customer address is where the driver picks up FROM. If you're switching the
 * FACILITY drop-off, you'll need to use the restaurantAddress field instead.
 */
export async function switchPickupDropoff(
  bookingId: string,
  newFacilityAddress: string
): Promise<{ ok: boolean; error?: string }> {
  const { pickupId } = await getShipdayIds(bookingId)

  if (!pickupId) {
    return { ok: false, error: "No Shipday pickup order ID on record for this booking" }
  }

  const ok = await patchShipdayOrder(pickupId, { customerAddress: newFacilityAddress })
  return { ok }
}

/**
 * Assign a driver to both the pickup and delivery Shipday orders.
 * Pass the driver's email address as registered in Shipday.
 */
export async function assignDriver(
  bookingId: string,
  driverEmail: string
): Promise<{ ok: boolean; pickupAssigned: boolean; deliveryAssigned: boolean }> {
  const { pickupId, deliveryId } = await getShipdayIds(bookingId)

  const [pickupAssigned, deliveryAssigned] = await Promise.all([
    pickupId ? assignShipdayDriver(pickupId, driverEmail) : Promise.resolve(false),
    deliveryId ? assignShipdayDriver(deliveryId, driverEmail) : Promise.resolve(false),
  ])

  return { ok: pickupAssigned || deliveryAssigned, pickupAssigned, deliveryAssigned }
}

/**
 * Cancel both Shipday orders for a booking (e.g. customer cancels).
 * Does NOT cancel the booking in our DB — call updateBookingStatus separately.
 */
export async function cancelShipdayOrders(
  bookingId: string
): Promise<{ ok: boolean; pickupCancelled: boolean; deliveryCancelled: boolean }> {
  const { pickupId, deliveryId } = await getShipdayIds(bookingId)

  const [pickupCancelled, deliveryCancelled] = await Promise.all([
    pickupId ? deleteShipdayOrder(pickupId) : Promise.resolve(false),
    deliveryId ? deleteShipdayOrder(deliveryId) : Promise.resolve(false),
  ])

  return { ok: pickupCancelled || deliveryCancelled, pickupCancelled, deliveryCancelled }
}
