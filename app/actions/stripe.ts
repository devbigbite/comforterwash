"use server"

import { stripe } from "@/lib/stripe"
import { PRODUCTS } from "@/lib/products"
import { createBooking } from "./bookings"

export async function startCheckoutSession(productId: string, quantity = 1, metadata?: Record<string, string>) {
  const product = PRODUCTS.find((p) => p.id === productId)
  if (!product) {
    throw new Error(`Product with id "${productId}" not found`)
  }

  // Create Checkout Sessions from body params.
  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    redirect_on_completion: "never",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: product.name,
            description: product.description,
          },
          unit_amount: product.priceInCents,
        },
        quantity: quantity,
      },
    ],
    mode: "payment",
    metadata: metadata || {},
  })

  return { clientSecret: session.client_secret!, sessionId: session.id }
}

export async function handleSuccessfulPayment(sessionId: string) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status === "paid" && session.metadata) {
      const metadata = session.metadata

      await createBooking({
        customerName: metadata.customerName,
        customerEmail: metadata.customerEmail,
        customerPhone: metadata.customerPhone,
        customerAddress: metadata.address,
        pickupDate: metadata.pickupDate,
        pickupTimeWindow: metadata.pickupTimeWindow,
        deliveryDate: metadata.deliveryDate,
        deliveryTimeWindow: metadata.deliveryTimeWindow,
        numComforters: Number.parseInt(metadata.quantity || "1"),
        totalAmount: session.amount_total || 0,
        stripePaymentIntentId: session.payment_intent as string,
      })
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] Error handling successful payment:", error)
    return { success: false, error: "Failed to save booking" }
  }
}
