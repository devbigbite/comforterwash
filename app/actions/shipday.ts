"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getShipdayConfig } from "@/lib/location"
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
    const { apiKey } = await getShipdayConfig()
    await patchShipdayOrder(pickupId, {
      pickupDate: newPickupDate,
      pickupTimeWindow: newPickupTimeWindow,
    }, apiKey)
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
    const { apiKey } = await getShipdayConfig()
    await patchShipdayOrder(deliveryId, {
      pickupDate: newDeliveryDate,
      pickupTimeWindow: newDeliveryTimeWindow,
    }, apiKey)
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

  const { apiKey } = await getShipdayConfig()
  const ok = await patchShipdayOrder(pickupId, { customerAddress: newFacilityAddress }, apiKey)
  return { ok }
}

/**
 * Assign a driver to both the pickup and delivery Shipday orders.
 * Pass the driver's email address as registered in Shipday.
 *
 * @deprecated Kept only for any caller that genuinely wants the same driver
 * on both legs. The pickup driver and delivery driver are not always the
 * same person — the admin dispatch board now assigns each leg separately
 * via assignPickupDriver/assignDeliveryDriver below, matching the two
 * separate DB columns (assigned_driver_id / assigned_delivery_driver_id).
 */
export async function assignDriver(
  bookingId: string,
  driverEmail: string
): Promise<{ ok: boolean; pickupAssigned: boolean; deliveryAssigned: boolean }> {
  const { pickupId, deliveryId } = await getShipdayIds(bookingId)
  const { apiKey } = await getShipdayConfig()

  const [pickupAssigned, deliveryAssigned] = await Promise.all([
    pickupId ? assignShipdayDriver(pickupId, driverEmail, apiKey) : Promise.resolve(false),
    deliveryId ? assignShipdayDriver(deliveryId, driverEmail, apiKey) : Promise.resolve(false),
  ])

  return { ok: pickupAssigned || deliveryAssigned, pickupAssigned, deliveryAssigned }
}

/** Assign a driver to only the pickup leg's Shipday order (customer -> facility/warehouse). */
export async function assignPickupDriver(
  bookingId: string,
  driverEmail: string
): Promise<{ ok: boolean }> {
  const { pickupId } = await getShipdayIds(bookingId)
  if (!pickupId) return { ok: false }
  const { apiKey } = await getShipdayConfig()
  const ok = await assignShipdayDriver(pickupId, driverEmail, apiKey)
  return { ok }
}

/** Assign a driver to only the delivery leg's Shipday order (facility/warehouse -> customer). */
export async function assignDeliveryDriver(
  bookingId: string,
  driverEmail: string
): Promise<{ ok: boolean }> {
  const { deliveryId } = await getShipdayIds(bookingId)
  if (!deliveryId) return { ok: false }
  const { apiKey } = await getShipdayConfig()
  const ok = await assignShipdayDriver(deliveryId, driverEmail, apiKey)
  return { ok }
}

/**
 * Cancel both Shipday orders for a booking (e.g. customer cancels).
 * Does NOT cancel the booking in our DB — call updateBookingStatus separately.
 */
export async function cancelShipdayOrders(
  bookingId: string
): Promise<{ ok: boolean; pickupCancelled: boolean; deliveryCancelled: boolean }> {
  const { pickupId, deliveryId } = await getShipdayIds(bookingId)
  const { apiKey } = await getShipdayConfig()

  const [pickupCancelled, deliveryCancelled] = await Promise.all([
    pickupId ? deleteShipdayOrder(pickupId, apiKey) : Promise.resolve(false),
    deliveryId ? deleteShipdayOrder(deliveryId, apiKey) : Promise.resolve(false),
  ])

  return { ok: pickupCancelled || deliveryCancelled, pickupCancelled, deliveryCancelled }
}

/**
 * Change a booking's pickup and/or delivery address after it was created, and
 * push the change to Shipday so the driver's app doesn't keep routing to the
 * old one.
 *
 * Why this exists: there was previously NO way to edit an address anywhere in
 * the app — the admin order page rendered it read-only and no action touched
 * `customer_address`. Corrections needed direct SQL. Compounding it, nothing
 * ever re-synced Shipday: `patchShipdayOrder` has always supported an address
 * but the only caller passing one (`switchPickupDropoff`) is dead code, so a
 * corrected address would have stayed stale in the driver's app forever.
 *
 * Also clears the cached geocode — `address_lat`/`address_lng` were resolved
 * from the OLD string, and a stale lat/lng is worse than none: routing would
 * silently keep using the old coordinates while every screen showed the new
 * address. They get re-resolved on next use.
 */
export async function updateOrderAddress(
  bookingId: string,
  customerAddress: string,
  deliveryAddress: string,
): Promise<{ ok: boolean; error?: string; shipdaySynced?: boolean; shipdayWarning?: string }> {
  const pickup   = customerAddress.trim()
  const delivery = deliveryAddress.trim()
  if (!pickup)   return { ok: false, error: "Pickup address can't be empty." }
  if (!delivery) return { ok: false, error: "Delivery address can't be empty." }

  const supabase = createAdminClient()

  const { data: before, error: readError } = await supabase
    .from("bookings")
    .select("customer_address, delivery_address, status")
    .eq("id", bookingId)
    .single()

  if (readError || !before) return { ok: false, error: "Order not found." }

  if (before.customer_address === pickup && before.delivery_address === delivery) {
    return { ok: true, shipdaySynced: true }
  }

  const { error: dbError } = await supabase
    .from("bookings")
    .update({
      customer_address: pickup,
      delivery_address: delivery,
      address_lat: null,
      address_lng: null,
    })
    .eq("id", bookingId)

  if (dbError) return { ok: false, error: dbError.message }

  // Audit trail — an address change after booking is exactly the kind of edit
  // someone will need to reconstruct later ("the driver went where?").
  await supabase.from("order_events").insert({
    booking_id: bookingId,
    event_type: "address_corrected",
    notes:
      `Pickup: "${before.customer_address ?? ""}" -> "${pickup}"` +
      (before.delivery_address !== delivery
        ? ` | Delivery: "${before.delivery_address ?? ""}" -> "${delivery}"`
        : ""),
    created_by: "admin",
  })

  // Push to Shipday. A failure here is NOT a failure of the edit — the DB is
  // already correct and every internal screen will show it. It does mean a
  // human has to fix Shipday by hand, so say so plainly rather than swallowing
  // it or rolling back a correction the customer is waiting on.
  const { pickupId, deliveryId } = await getShipdayIds(bookingId)
  const { apiKey } = await getShipdayConfig()

  const results: boolean[] = []
  if (pickupId)   results.push(await patchShipdayOrder(pickupId,   { customerAddress: pickup },   apiKey))
  if (deliveryId) results.push(await patchShipdayOrder(deliveryId, { customerAddress: delivery }, apiKey))

  if (results.length === 0) {
    return {
      ok: true,
      shipdaySynced: false,
      shipdayWarning: "This order has no Shipday orders, so nothing needed syncing.",
    }
  }
  if (results.some(r => !r)) {
    return {
      ok: true,
      shipdaySynced: false,
      shipdayWarning: "Saved here, but Shipday did NOT accept the change — update the stop in Shipday manually or the driver will route to the old address.",
    }
  }

  return { ok: true, shipdaySynced: true }
}
