"use client"

import { useCallback, useRef, useState } from "react"
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { startCheckoutSession, handleSuccessfulPayment } from "@/app/actions/stripe"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2 } from "lucide-react"
import { useLang } from "@/components/lang-provider"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface CheckoutProps {
  amountCents: number
  label: string
  metadata?: Record<string, string>
  manualCapture?: boolean
  onSuccess?: () => void
}

export default function Checkout({ amountCents, label, metadata, manualCapture = false, onSuccess }: CheckoutProps) {
  const [paymentComplete, setPaymentComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const { translations: tr } = useLang()
  const t = tr.checkout

  const fetchClientSecret = useCallback(async () => {
    const { clientSecret, sessionId } = await startCheckoutSession(
      amountCents,
      label,
      metadata,
      manualCapture
    )
    sessionIdRef.current = sessionId
    return clientSecret
  }, [amountCents, label, metadata, manualCapture])

  const handleComplete = useCallback(async () => {
    if (!sessionIdRef.current) return
    const result = await handleSuccessfulPayment(sessionIdRef.current)
    if (result.success) {
      setPaymentComplete(true)
      onSuccess?.()
    } else {
      setError(t.saveError)
    }
  }, [onSuccess, t.saveError])

  if (paymentComplete) {
    return (
      <Alert className="border-green-500 bg-green-50">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          {manualCapture ? t.preAuthSuccess : t.paySuccess}
        </AlertDescription>
      </Alert>
    )
  }

  if (error) {
    return (
      <Alert className="border-red-500 bg-red-50">
        <AlertDescription className="text-red-800">{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{ fetchClientSecret, onComplete: handleComplete }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  )
}
