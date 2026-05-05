const SHIPDAY_API_URL = "https://api.shipday.com"

function getAuthHeader(apiKey: string): string {
  return `Basic ${Buffer.from(apiKey + ":").toString("base64")}`
}

function timeWindowToShipdayTime(date: string, window: string): string {
  // Use midpoint of each window: 9am-1pm → 11:00 AM, 3pm-7pm → 05:00 PM
  const [year, month, day] = date.split("-")
  const hour = window.startsWith("9") ? 11 : 17
  const ampm = hour >= 12 ? "PM" : "AM"
  const displayHour = hour > 12 ? hour - 12 : hour
  return `${month}/${day}/${year} ${String(displayHour).padStart(2, "0")}:00 ${ampm}`
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

export async function createShipdayOrder(booking: ShipdayOrderInput): Promise<void> {
  const apiKey = process.env.SHIPDAY_API_KEY
  if (!apiKey) {
    console.error("[shipday] SHIPDAY_API_KEY not set — skipping dispatch")
    return
  }

  const unitPrice = (booking.total_amount / booking.num_comforters / 100).toFixed(2)
  const total = (booking.total_amount / 100).toFixed(2)

  const payload = {
    orderNumber: booking.id.slice(0, 8).toUpperCase(),
    customerName: booking.customer_name,
    customerAddress: booking.customer_address,
    customerEmail: booking.customer_email,
    customerPhoneNumber: booking.customer_phone,
    restaurantName: "WashFold Orlando",
    restaurantAddress: process.env.BUSINESS_ADDRESS ?? "Orlando, FL",
    restaurantPhoneNumber: process.env.BUSINESS_PHONE ?? "",
    expectedPickupTime: timeWindowToShipdayTime(booking.pickup_date, booking.pickup_time_window),
    expectedDeliveryTime: timeWindowToShipdayTime(booking.delivery_date, booking.delivery_time_window),
    paymentMethod: "PAID_ONLINE",
    subtotal: total,
    tax: "0.00",
    totalOrderCost: total,
    tips: "0.00",
    orderItems: Array.from({ length: booking.num_comforters }, (_, i) => ({
      name: "Comforter Wash & Delivery",
      quantity: 1,
      unitPrice,
      details: `Comforter #${i + 1}`,
    })),
  }

  try {
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
      console.error(`[shipday] Auth used: Basic ${Buffer.from(apiKey + ":").toString("base64").slice(0, 10)}...`)
      return
    }

    console.log("[shipday] Order created successfully:", responseText.slice(0, 200))
  } catch (err) {
    console.error("[shipday] Network error:", err)
  }
}
