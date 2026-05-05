"use client"

import { useCallback, useEffect, useState } from "react"
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"

import { startCheckoutSession } from "@/app/actions/stripe"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2 } from "lucide-react"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface CheckoutProps {
  productId: string
  quantity: number
  metadata?: Record<string, string>
}

export default function Checkout({ productId, quantity, metadata }: CheckoutProps) {
  const [paymentComplete, setPaymentComplete] = useState(false)
  const [enhancedMetadata, setEnhancedMetadata] = useState(() => ({
    ...metadata,
    quantity: quantity.toString(),
  }))

  const startCheckoutSessionForProduct = useCallback(
    () => startCheckoutSession(productId, quantity, enhancedMetadata),
    [productId, quantity],
  )

  useEffect(() => {
    const checkPaymentStatus = async () => {
      const clientSecret = new URLSearchParams(window.location.search).get("payment_intent_client_secret")

      if (clientSecret) {
        const stripe = await stripePromise
        if (!stripe) return

        const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret)

        if (paymentIntent?.status === "succeeded") {
          setPaymentComplete(true)
          // Note: In production, use webhooks instead of client-side detection
          // This is a simplified approach for the demo
        }
      }
    }

    checkPaymentStatus()
  }, [])

  if (paymentComplete) {
    return (
      <Alert className="border-green-500 bg-green-50">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          Payment successful! Your booking has been confirmed. You'll receive a confirmation email shortly.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret: startCheckoutSessionForProduct }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  )
}
