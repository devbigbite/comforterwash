const SHIPDAY_API_URL = "https://api.shipday.com"

function getAuthHeader(apiKey: string): string {
  return `Basic ${apiKey}`
}

function timeWindowToTime(window: string): string {
  const hour = window.startsWith("9") ? 11 : 17
  return `${String(hour).padStart(2, "0")}:00:00`
}

function toShipdayDate(date: string): string {
  const [year, month, day] = date.split("-")
  return `${month}/${day}/${year}`
}

export interface ShipdayOrderInput {
  id: string
  short_code?: string | null
  customer_name: string
  customer_email: string
  customer_phone: string
  customer_address: string
  pickup_date: string
  pickup_time_window: string
  delivery_date: string
  delivery_time_window: string
  num_comforters: number
  total_amount: number
  service_type?: "comforter_wash" | "wash_fold" | "wash_only"
  pounds?: number
  num_bags?: number
}

export interface ShipdayOrderIds {
  pickupOrderId: number | null
  deliveryOrderId: number | null
}

/** POST /orders — returns Shipday numeric orderId, or null on failure. */
async function postShipdayOrder(apiKey: string, payload: object): Promise<number | null> {
  const res = await fetch(`${SHIPDAY_API_URL}/orders`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(apiKey),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  })

  const responseText = await res.text()
  if (!res.ok) {
    console.error(`[shipday] POST /orders HTTP ${res.status} — ${responseText.slice(0, 500)}`)
    return null
  }

  try {
    const json = JSON.parse(responseText)
    const id = json?.orderId ?? json?.order?.orderId ?? null
    if (id) console.log(`[shipday] Order created, id=${id}`)
    return typeof id === "number" ? id : null
  } catch {
    console.error("[shipday] Failed to parse order creation response:", responseText.slice(0, 200))
    return null
  }
}

/** PUT /orders/{orderId} — patch date, time, or address on an existing Shipday order. */
export async function patchShipdayOrder(
  orderId: number,
  updates: {
    customerAddress?: string
    pickupDate?: string
    expectedPickupTime?: string
    pickupTimeWindow?: string
  }
): Promise<boolean> {
  const apiKey = process.env.SHIPDAY_API_KEY
  if (!apiKey) {
    console.error("[shipday] SHIPDAY_API_KEY not set — skipping patch")
    return false
  }

  const payload: Record<string, string> = {}
  if (updates.customerAddress) payload.customerAddress = updates.customerAddress
  if (updates.pickupDate) payload.pickupDate = toShipdayDate(updates.pickupDate)
  if (updates.pickupTimeWindow) payload.expectedPickupTime = timeWindowToTime(updates.pickupTimeWindow)
  if (updates.expectedPickupTime) payload.expectedPickupTime = updates.expectedPickupTime

  if (Object.keys(payload).length === 0) {
    console.warn("[shipday] patchShipdayOrder called with no fields to update")
    return false
  }

  try {
    const res = await fetch(`${SHIPDAY_API_URL}/orders/${orderId}`, {
      method: "PUT",
      headers: {
        Authorization: getAuthHeader(apiKey),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[shipday] PUT /orders/${orderId} HTTP ${res.status} — ${body.slice(0, 300)}`)
      return false
    }

    console.log(`[shipday] Order ${orderId} patched:`, payload)
    return true
  } catch (err) {
    console.error(`[shipday] Network error patching order ${orderId}:`, err)
    return false
  }
}

/** DELETE /orders/{orderId} — remove a Shipday order from driver queues. */
export async function deleteShipdayOrder(orderId: number): Promise<boolean> {
  const apiKey = process.env.SHIPDAY_API_KEY
  if (!apiKey) {
    console.error("[shipday] SHIPDAY_API_KEY not set — skipping delete")
    return false
  }

  try {
    const res = await fetch(`${SHIPDAY_API_URL}/orders/${orderId}`, {
      method: "DELETE",
      headers: {
        Authorization: getAuthHeader(apiKey),
        Accept: "application/json",
      },
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[shipday] DELETE /orders/${orderId} HTTP ${res.status} — ${body.slice(0, 300)}`)
      return false
    }

    console.log(`[shipday] Order ${orderId} deleted`)
    return true
  } catch (err) {
    console.error(`[shipday] Network error deleting order ${orderId}:`, err)
    return false
  }
}

/** POST /orders/{orderId}/assign — assign a carrier by their Shipday email. */
export async function assignShipdayDriver(
  orderId: number,
  carrierEmail: string
): Promise<boolean> {
  const apiKey = process.env.SHIPDAY_API_KEY
  if (!apiKey) return false

  try {
    const res = await fetch(`${SHIPDAY_API_URL}/orders/${orderId}/assign`, {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(apiKey),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ carrierEmail }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[shipday] Assign carrier HTTP ${res.status} — ${body.slice(0, 300)}`)
      return false
    }

    console.log(`[shipday] Order ${orderId} assigned to ${carrierEmail}`)
    return true
  } catch (err) {
    console.error(`[shipday] Network error assigning order ${orderId}:`, err)
    return false
  }
}

export async function createShipdayOrder(booking: ShipdayOrderInput): Promise<ShipdayOrderIds> {
  const apiKey = process.env.SHIPDAY_API_KEY
  if (!apiKey) {
    console.error("[shipday] SHIPDAY_API_KEY not set — skipping dispatch")
    return { pickupOrderId: null, deliveryOrderId: null }
  }

  const baseCode = booking.short_code ?? booking.id.slice(0, 6).toUpperCase()
  const total = (booking.total_amount / 100).toFixed(2)
  const facilityAddress = process.env.BUSINESS_ADDRESS ?? "Orlando, FL"
  const facilityPhone = process.env.BUSINESS_PHONE ?? ""

  const isWashFold = booking.service_type === "wash_fold"
  const isWashOnly = booking.service_type === "wash_only"

  const pickupItems = isWashFold
    ? [{
        name: "Wash & Fold — Pickup",
        quantity: booking.num_bags ?? 1,
        unitPrice: total,
        details: `Wash & Fold pickup — est. ${booking.pounds ?? "?"} lbs across ${booking.num_bags ?? 1} bag(s). Final charge based on actual weight.`,
      }]
    : isWashOnly
    ? [{
        name: "Wash Only — Pickup",
        quantity: booking.num_bags ?? 1,
        unitPrice: total,
        details: `Wash Only pickup — est. ${booking.pounds ?? "?"} lbs across ${booking.num_bags ?? 1} bag(s). Final charge based on actual weight.`,
      }]
    : Array.from({ length: booking.num_comforters }, (_, i) => ({
        name: "Comforter Wash — Pickup",
        quantity: 1,
        unitPrice: (booking.total_amount / booking.num_comforters / 100).toFixed(2),
        details: `Comforter #${i + 1} — Pickup`,
      }))

  const deliveryItems = isWashFold
    ? [{
        name: "Wash & Fold — Delivery",
        quantity: booking.num_bags ?? 1,
        unitPrice: total,
        details: `Wash & Fold delivery — clean, folded laundry returned to customer.`,
      }]
    : isWashOnly
    ? [{
        name: "Wash Only — Delivery",
        quantity: booking.num_bags ?? 1,
        unitPrice: total,
        details: `Wash Only delivery — clean laundry returned in bag, unfolded.`,
      }]
    : Array.from({ length: booking.num_comforters }, (_, i) => ({
        name: "Comforter Wash — Delivery",
        quantity: 1,
        unitPrice: (booking.total_amount / booking.num_comforters / 100).toFixed(2),
        details: `Comforter #${i + 1} — Delivery`,
      }))

  const pickupPayload = {
    orderNumber: `${baseCode}P`,
    customerName: booking.customer_name,
    customerAddress: booking.customer_address,
    customerEmail: booking.customer_email,
    customerPhoneNumber: booking.customer_phone,
    restaurantName: "WashFold Orlando",
    restaurantAddress: facilityAddress,
    restaurantPhoneNumber: facilityPhone,
    pickupDate: toShipdayDate(booking.pickup_date),
    expectedPickupTime: timeWindowToTime(booking.pickup_time_window),
    paymentMethod: "PAID_ONLINE",
    subtotal: total,
    tax: "0.00",
    totalOrderCost: total,
    tips: "0.00",
    orderItems: pickupItems,
  }

  const deliveryPayload = {
    orderNumber: `${baseCode}D`,
    customerName: booking.customer_name,
    customerAddress: booking.customer_address,
    customerEmail: booking.customer_email,
    customerPhoneNumber: booking.customer_phone,
    restaurantName: "WashFold Orlando",
    restaurantAddress: facilityAddress,
    restaurantPhoneNumber: facilityPhone,
    pickupDate: toShipdayDate(booking.delivery_date),
    expectedPickupTime: timeWindowToTime(booking.delivery_time_window),
    paymentMethod: "PAID_ONLINE",
    subtotal: total,
    tax: "0.00",
    totalOrderCost: total,
    tips: "0.00",
    orderItems: deliveryItems,
  }

  let pickupOrderId: number | null = null
  let deliveryOrderId: number | null = null

  try {
    pickupOrderId = await postShipdayOrder(apiKey, pickupPayload)
    deliveryOrderId = await postShipdayOrder(apiKey, deliveryPayload)
  } catch (err) {
    console.error("[shipday] Network error creating orders:", err)
  }

  return { pickupOrderId, deliveryOrderId }
}

// ─────────────────────────────────────────────────────────────────────────────
// Transport Run → Shipday
// Creates a single Shipday order representing a warehouse↔facility run.
// The "restaurant" (origin) and "customer" (destination) are both internal
// addresses — no real customer is involved.
// ─────────────────────────────────────────────────────────────────────────────
export interface ShipdayRunInput {
  runId:        string
  runType:      "to_facility" | "to_warehouse"
  facilityName: string
  fromAddress:  string   // origin address
  toAddress:    string   // destination address
  orderSummary: string   // e.g. "4 orders · 14 bags"
  runDate:      string   // YYYY-MM-DD (today)
}

export async function createShipdayRunOrder(run: ShipdayRunInput): Promise<number | null> {
  const apiKey = process.env.SHIPDAY_API_KEY
  if (!apiKey) {
    console.error("[shipday] SHIPDAY_API_KEY not set — skipping run dispatch")
    return null
  }

  const shortId   = run.runId.slice(0, 8).toUpperCase()
  const prefix    = run.runType === "to_facility" ? "RUN" : "RTN"
  const orderNum  = `${prefix}-${shortId}`
  const label     = run.runType === "to_facility"
    ? `Warehouse → ${run.facilityName}`
    : `${run.facilityName} → Warehouse`

  const payload = {
    orderNumber:           orderNum,
    customerName:          run.runType === "to_facility" ? run.facilityName : "WashFold Warehouse",
    customerAddress:       run.toAddress,
    customerEmail:         "",
    customerPhoneNumber:   "",
    restaurantName:        run.runType === "to_facility" ? "WashFold Warehouse" : run.facilityName,
    restaurantAddress:     run.fromAddress,
    restaurantPhoneNumber: process.env.BUSINESS_PHONE ?? "",
    pickupDate:            toShipdayDate(run.runDate),
    expectedPickupTime:    "09:00:00",
    paymentMethod:         "NO_PAYMENT",
    subtotal:              "0.00",
    tax:                   "0.00",
    totalOrderCost:        "0.00",
    tips:                  "0.00",
    orderItems: [
      {
        name:      label,
        quantity:  1,
        unitPrice: "0.00",
        details:   run.orderSummary,
      },
    ],
  }

  try {
    const id = await postShipdayOrder(apiKey, payload)
    if (id) console.log(`[shipday] Run order created: ${orderNum} → Shipday id=${id}`)
    return id
  } catch (err) {
    console.error("[shipday] Failed to create run order:", err)
    return null
  }
}
