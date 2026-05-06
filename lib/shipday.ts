const SHIPDAY_API_URL = "https://api.shipday.com"

function getAuthHeader(apiKey: string): string {
  return `Basic ${apiKey}`
}

function timeWindowToTime(window: string): string {
  // Shipday expects HH:mm:ss (24-hour)
  // 9am-1pm midpoint → 11:00:00, 3pm-7pm midpoint → 17:00:00
  const hour = window.startsWith("9") ? 11 : 17
  return `${String(hour).padStart(2, "0")}:00:00`
}

function toShipdayDate(date: string): string {
  // YYYY-MM-DD → MM/DD/YYYY
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

async function postShipdayOrder(apiKey: string, payload: object): Promise<void> {
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
    console.error(`[shipday] HTTP ${res.status} — response: ${responseText.slice(0, 500)}`)
    return
  }

  console.log("[shipday] Order created:", responseText.slice(0, 200))
}

export async function createShipdayOrder(booking: ShipdayOrderInput): Promise<void> {
  const apiKey = process.env.SHIPDAY_API_KEY
  if (!apiKey) {
    console.error("[shipday] SHIPDAY_API_KEY not set — skipping dispatch")
    return
  }

  const baseCode = booking.short_code ?? booking.id.slice(0, 6).toUpperCase()
  const total = (booking.total_amount / 100).toFixed(2)
  const facilityAddress = process.env.BUSINESS_ADDRESS ?? "Orlando, FL"
  const facilityPhone = process.env.BUSINESS_PHONE ?? ""

  const isWashFold = booking.service_type === "wash_fold"
  const isWashOnly = booking.service_type === "wash_only"

  // Build order items based on service type
  const pickupItems = isWashFold
    ? [{
        name: "Wash & Fold — Pickup",
        quantity: booking.num_bags ?? 1,
        unitPrice: total,
        details: `Wash & Fold pickup — est. ${booking.pounds ?? "?"} lbs across ${booking.num_bags ?? 1} bag(s). Final charge based on actual weight at drop-off.`,
      }]
    : isWashOnly
    ? [{
        name: "Wash Only — Pickup",
        quantity: booking.num_bags ?? 1,
        unitPrice: total,
        details: `Wash Only pickup — est. ${booking.pounds ?? "?"} lbs across ${booking.num_bags ?? 1} bag(s). Returned clean, unfolded. Final charge based on actual weight.`,
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

  // ── Pickup order: driver goes to customer, collects laundry ──
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

  // ── Delivery order: driver returns clean laundry to customer ──
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

  try {
    await postShipdayOrder(apiKey, pickupPayload)
    await postShipdayOrder(apiKey, deliveryPayload)
  } catch (err) {
    console.error("[shipday] Network error:", err)
  }
}
