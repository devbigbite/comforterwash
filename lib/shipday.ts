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

  const baseCode = booking.id.slice(0, 8).toUpperCase()
  const unitPrice = (booking.total_amount / booking.num_comforters / 100).toFixed(2)
  const total = (booking.total_amount / 100).toFixed(2)
  const facilityAddress = process.env.BUSINESS_ADDRESS ?? "Orlando, FL"
  const facilityPhone = process.env.BUSINESS_PHONE ?? ""

  // ── Pickup order: driver goes to customer, collects dirty comforter ──
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
    orderItems: Array.from({ length: booking.num_comforters }, (_, i) => ({
      name: "Comforter Pickup",
      quantity: 1,
      unitPrice,
      details: `Comforter #${i + 1} — Pickup`,
    })),
  }

  // ── Delivery order: driver takes clean comforter back to customer ──
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
    orderItems: Array.from({ length: booking.num_comforters }, (_, i) => ({
      name: "Comforter Delivery",
      quantity: 1,
      unitPrice,
      details: `Comforter #${i + 1} — Delivery`,
    })),
  }

  try {
    await postShipdayOrder(apiKey, pickupPayload)
    await postShipdayOrder(apiKey, deliveryPayload)
  } catch (err) {
    console.error("[shipday] Network error:", err)
  }
}
