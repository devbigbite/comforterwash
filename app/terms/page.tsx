import Link from "next/link"

export const metadata = { title: "Terms of Service — WashFold Orlando" }

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-[#0D2240] px-4 py-12 text-center">
        <h1 className="text-3xl font-extrabold text-white">Terms of Service</h1>
        <p className="text-white/50 text-sm mt-2">Last updated: May 2026</p>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-14 space-y-10 text-[#0D2240]">

        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">1. Service Overview</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            WashFold Orlando provides pickup and delivery laundry services in the greater Orlando area,
            including Comforter Wash, Wash &amp; Fold, and Wash Only. By booking a service, you agree
            to these terms in full.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">2. Pricing &amp; Billing</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Wash &amp; Fold orders are priced per pound based on the weight we receive at pickup.
            A pre-authorization hold is placed on your card at the time of booking to cover the
            estimated total. Your card is only charged the actual amount once your order has been
            weighed and processed.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Comforter Wash orders are priced by size (Twin, Full, Queen, King) as shown at the time
            of booking. The price shown is the final price — no weight adjustment applies.
          </p>
        </section>

        <section className="space-y-3 rounded-xl border border-amber-100 bg-amber-50 p-5">
          <h2 className="text-lg font-extrabold text-amber-800">3. Wet or Damp Items</h2>
          <p className="text-sm text-amber-700 leading-relaxed">
            We charge based on the weight of items as received at pickup. If your laundry arrives
            noticeably wet or damp — for example, towels or clothes that have not fully dried —
            our team will flag this on your order and may adjust the billed weight to reflect a
            reasonable dry estimate. We will always notify you before any adjustment is applied.
          </p>
          <p className="text-sm text-amber-700 leading-relaxed">
            To avoid discrepancies, please ensure items are dry or allow us to note the condition
            at pickup.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">4. Pickup &amp; Delivery</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            We will do our best to arrive within your selected time window (9:00 AM – 1:00 PM or
            3:00 PM – 7:00 PM). Delays due to traffic, weather, or high order volume may occur.
            We will notify you by text if we are running significantly outside your window.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            If no one is available at pickup, please leave your items in an agreed location (front
            door, lobby, etc.) and note this in your booking. We are not responsible for items left
            unattended in unsecured locations.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">5. Care &amp; Liability</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            We take great care with every order. However, we are not responsible for damage to items
            that are not colorfast, pre-damaged, or require special handling not noted at booking.
            Items with care labels indicating dry-clean only or hand-wash only should not be included
            in Wash &amp; Fold orders.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Our liability for any lost or damaged item is limited to 5× the per-pound rate for that
            order, up to a maximum of $100 per item.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">6. Cancellations</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            You may cancel or reschedule your order at no charge up to 2 hours before your scheduled
            pickup window. Cancellations made after that point may be subject to a $10 cancellation fee
            to cover driver dispatch costs. Contact us at{" "}
            <a href="mailto:hello@comforterwash.com" className="text-[#E8726A] underline">
              hello@comforterwash.com
            </a>{" "}
            to cancel or reschedule.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">7. Recurring Subscriptions</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Weekly and biweekly subscription plans continue automatically until cancelled. You may
            pause or cancel at any time through your account dashboard or by contacting us directly.
            Cancellations take effect at the end of the current billing cycle.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">8. Contact</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Questions about these terms? Reach us at{" "}
            <a href="mailto:hello@comforterwash.com" className="text-[#E8726A] underline">
              hello@comforterwash.com
            </a>.
          </p>
        </section>

        <div className="border-t border-gray-100 pt-6 flex gap-4 text-xs text-gray-400">
          <Link href="/" className="hover:text-[#E8726A] transition-colors">← Back to Home</Link>
          <Link href="/privacy" className="hover:text-[#E8726A] transition-colors">Privacy Policy</Link>
        </div>
      </div>
    </main>
  )
}
