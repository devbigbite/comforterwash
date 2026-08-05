"use client"

import { useCallback, useRef, useState } from "react"
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { createCommercialCardSetupSession, saveCommercialCardFromSetupSession } from "@/app/actions/commercial-accounts"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2 } from "lucide-react"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface CommercialCardSetupProps {
  accountId: string
  onSuccess?: (result: { brand?: string; last4?: string }) => void
}

// Collects a card on file for a commercial account via Stripe Embedded
// Checkout in `mode: "setup"` — no charge happens here. The card is charged
// later, off-session, at weigh-in (see chargeCommercialAccountOrder in
// app/actions/stripe.ts). Mirrors components/checkout.tsx's existing pattern.
export default function CommercialCardSetup({ accountId, onSuccess }: CommercialCardSetupProps) {
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  const fetchClientSecret = useCallback(async () => {
    const result = await createCommercialCardSetupSession(accountId)
    if (result.error || !result.clientSecret) {
      setError(result.error ?? "Failed to start card setup")
      throw new Error(result.error ?? "Failed to start card setup")
    }
    sessionIdRef.current = result.sessionId!
    return result.clientSecret
  }, [accountId])

  const handleComplete = useCallback(async () => {
    if (!sessionIdRef.current) return
    const result = await saveCommercialCardFromSetupSession(sessionIdRef.current, accountId)
    if (result.success) {
      setDone(true)
      onSuccess?.(result)
    } else {
      setError(result.error ?? "Failed to save card")
    }
  }, [accountId, onSuccess])

  if (done) {
    return (
      <Alert className="border-green-500 bg-green-50">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">Card on file saved successfully.</AlertDescription>
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
    <div id="commercial-card-setup">
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{ fetchClientSecret, onComplete: handleComplete }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  )
}
