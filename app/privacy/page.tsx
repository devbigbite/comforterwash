import Link from "next/link"

export const metadata = { title: "Privacy Policy — WashFold Orlando" }

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-[#0D2240] px-4 py-12 text-center">
        <h1 className="text-3xl font-extrabold text-white">Privacy Policy</h1>
        <p className="text-white/50 text-sm mt-2">Last updated: May 2026</p>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-14 space-y-10 text-[#0D2240]">

        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">1. What We Collect</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            When you book a service or create an account, we collect your name, email address,
            phone number, and service address. We also collect order details such as service type,
            pickup/delivery dates, and payment information (processed securely through Stripe —
            we never store your full card number).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">2. How We Use It</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            We use your information solely to fulfill your orders, send order confirmations and
            status updates via email and SMS, and improve our service. We do not sell, rent, or
            share your personal information with third parties for marketing purposes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">3. SMS &amp; Email Communications</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            By providing your phone number, you consent to receive transactional SMS messages
            related to your order (confirmation, pickup reminders, delivery updates). Standard
            message and data rates may apply. You can opt out at any time by replying STOP.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            We may send transactional emails about your order and, with your consent, occasional
            promotional emails. You can unsubscribe at any time using the link in any email.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">4. Data Storage &amp; Security</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Your data is stored securely using Supabase (PostgreSQL) with encrypted connections.
            Payment processing is handled by Stripe, which is PCI-DSS compliant. We apply
            industry-standard security practices to protect your information.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">5. Third-Party Services</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            We use the following third-party services to operate our business:
          </p>
          <ul className="text-sm text-gray-600 space-y-1.5 list-disc list-inside">
            <li><strong>Stripe</strong> — payment processing</li>
            <li><strong>Supabase</strong> — database and authentication</li>
            <li><strong>Twilio</strong> — SMS notifications</li>
            <li><strong>Resend</strong> — email delivery</li>
            <li><strong>Shipday</strong> — driver dispatch and routing</li>
          </ul>
          <p className="text-sm text-gray-600 leading-relaxed">
            Each of these services has its own privacy policy governing how they handle data.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">6. Your Rights</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            You can request access to, correction of, or deletion of your personal data at any
            time by contacting us at{" "}
            <a href="mailto:hello@comforterwash.com" className="text-[#E8726A] underline">
              hello@comforterwash.com
            </a>. We will respond within 30 days.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">7. Cookies</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            We use essential cookies only — for authentication sessions and basic site functionality.
            We do not use tracking or advertising cookies.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">8. Contact</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Questions about this policy? Email us at{" "}
            <a href="mailto:hello@comforterwash.com" className="text-[#E8726A] underline">
              hello@comforterwash.com
            </a>.
          </p>
        </section>

        <div className="border-t border-gray-100 pt-6 flex gap-4 text-xs text-gray-400">
          <Link href="/" className="hover:text-[#E8726A] transition-colors">← Back to Home</Link>
          <Link href="/terms" className="hover:text-[#E8726A] transition-colors">Terms of Service</Link>
        </div>
      </div>
    </main>
  )
}
