import { SelfSignupForm } from "@/components/SelfSignupForm"
import { SELF_SIGNUP_PLAN } from "@/lib/platform-plan"

function fmt$(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export default function StartPage() {
  return (
    <div className="min-h-screen bg-[#f7f8fb] py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold text-[#0D2240]">Start Your Own Laundry Pickup & Delivery Business</h1>
          <p className="text-sm text-gray-500 mt-2">
            Booking site, dispatch board, and driver app — live in minutes, under your own name.
          </p>
        </div>

        <div className="bg-[#0D2240] text-white rounded-2xl p-6 mb-6 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-white/50 mb-1">{SELF_SIGNUP_PLAN.name}</p>
          <p className="text-3xl font-extrabold">{fmt$(SELF_SIGNUP_PLAN.monthlyPriceCents)}<span className="text-base font-semibold text-white/60">/mo</span></p>
          <p className="text-xs text-white/50 mt-1">
            + {fmt$(SELF_SIGNUP_PLAN.setupFeeCents)} one-time setup
          </p>
        </div>

        <SelfSignupForm />
      </div>
    </div>
  )
}
