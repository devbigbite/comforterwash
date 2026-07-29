"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { startCheckoutSession, handleSuccessfulPayment, checkCheckoutAllowed } from "@/app/actions/stripe"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2 } from "lucide-react"
import { useLang } from "@/components/lang-provider"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface CheckoutProps {
  amountCents: number
  label: string
  metadata?: Record<string, string>
  manualCapture?: boolean
  onSuccess?: (result?: { giftCardCode?: string }) => void
}

export default function Checkout({ amountCents, label, metadata, manualCapture = false, onSuccess }: CheckoutProps) {
  const [paymentComplete, setPaymentComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingAllowed, setCheckingAllowed] = useState(true)
  const [allowed, setAllowed] = useState(true)
  const sessionIdRef = useRef<string | null>(null)
  const { translations: tr } = useLang()
  const t = tr.checkout

  // Avoid ever mounting the embedded Stripe form if this tenant hasn't
  // finished their own Stripe Connect onboarding yet (see lib/stripe-connect.ts).
  useEffect(() => {
    let cancelled = false
    checkCheckoutAllowed().then(ok => { if (!cancelled) { setAllowed(ok); setCheckingAllowed(false) } })
    return () => { cancelled = true }
  }, [])

  const fetchClientSecret = useCallback(async () => {
    const result = await startCheckoutSession(
      amountCents,
      label,
      metadata,
      manualCapture
    )
    if ("error" in result) {
      setError(result.error)
      throw new Error(result.error)
    }
    sessionIdRef.current = result.sessionId
    return result.clientSecret
  }, [amountCents, label, metadata, manualCapture])

  const handleComplete = useCallback(async () => {
    if (!sessionIdRef.current) return
    const result = await handleSuccessfulPayment(sessionIdRef.current)
    if (result.success) {
      setPaymentComplete(true)
      onSuccess?.(result as { giftCardCode?: string })
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

  if (checkingAllowed) {
    return <div className="text-sm text-gray-400 text-center py-6">Loading checkout…</div>
  }

  if (!allowed) {
    return (
      <Alert className="border-amber-400 bg-amber-50">
        <AlertDescription className="text-amber-800">
          This business hasn't finished setting up online payments yet. Please check back soon, or contact them directly to book.
        </AlertDescription>
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
