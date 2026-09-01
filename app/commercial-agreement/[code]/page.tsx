import Link from "next/link"
import { notFound } from "next/navigation"
import { getCommercialAccountByCode, signCommercialAgreement } from "@/app/actions/commercial-accounts"
import { SignAgreementForm } from "./sign-form"
import CommercialCardSetup from "@/components/commercial-card-setup"
import { UpdatePaymentToggle } from "./update-payment-toggle"
import { getBranding } from "@/lib/location"

export default async function CommercialAgreementPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const [account, branding] = await Promise.all([getCommercialAccountByCode(code), getBranding()])
  if (!account) notFound()
  const businessName = branding.business_name

  const rateLabel =
    account.rate_type === "per_lb" ? "per pound" :
    account.rate_type === "per_load" ? "per load" : "flat rate"

  return (
    <div className="min-h-screen bg-[#f7f8fb] py-10 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-extrabold text-[#0D2240]">Commercial Laundry Service Agreement</h1>
            <p className="text-sm text-gray-400 mt-1">{businessName} · Commercial Recurring Service</p>
          </div>

          <div className="rounded-xl bg-[#f7f8fb] border border-gray-100 p-4 mb-6 text-sm text-[#0D2240] space-y-1">
            <p><span className="font-bold">Business:</span> {account.business_name}</p>
            {account.address && <p><span className="font-bold">Address:</span> {account.address}</p>}
            {account.contact_name && <p><span className="font-bold">Contact:</span> {account.contact_name}</p>}
            {account.rate_amount_cents != null && (
              <p><span className="font-bold">Rate:</span> ${(account.rate_amount_cents / 100).toFixed(2)} {rateLabel}</p>
            )}
            {account.minimum_amount_cents != null && (
              <p><span className="font-bold">Minimum charge:</span> ${(account.minimum_amount_cents / 100).toFixed(2)} per service</p>
            )}
          </div>

          {account.agreement_signed_at ? (
            <div className="space-y-6">
              <div className="rounded-xl bg-green-50 border border-green-200 p-5 text-center">
                <p className="font-bold text-green-700">✅ This agreement was signed</p>
                <p className="text-sm text-green-700/80 mt-1">
                  Signed by {account.agreement_signed_name} on {new Date(account.agreement_signed_at).toLocaleDateString()}
                </p>
              </div>

              {account.stripe_payment_method_id ? (
                <div className="space-y-3">
                  <div className="rounded-xl bg-green-50 border border-green-200 p-5 text-center">
                    <p className="font-bold text-green-700">✅ Payment method on file — account setup complete</p>
                    <p className="text-sm text-green-700/80 mt-1">
                      {account.card_brand ? `${account.card_brand.toUpperCase()} ` : ""}
                      {account.card_last4 ? `ending in ${account.card_last4}` : "Card saved"}
                    </p>
                    <Link
                      href={`/commercial-agreement/${code}/history`}
                      className="inline-block mt-3 text-sm font-bold text-[#0D2240] hover:underline"
                    >
                      View Order &amp; Billing History →
                    </Link>
                  </div>
                  {/* Lets the customer swap the card on file at any time —
                      e.g. after a decline like "connection to the user's
                      Link account has been closed," or if their card
                      expired. Previously the only path to a card already on
                      file was a one-time setup at signing; there was no way
                      to update it afterward without a manual admin/DB fix. */}
                  <UpdatePaymentToggle accountId={account.id} />
                </div>
              ) : (
                <div>
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 mb-3 text-sm text-amber-700">
                    One step left — a card on file is required to finish setting up your commercial account.
                  </div>
                  <h2 className="text-sm font-bold text-[#0D2240] mb-2">Add a payment method</h2>
                  <p className="text-xs text-gray-400 mb-3">
                    Your card is saved securely with Stripe and charged only after each order is weighed — nothing is charged today.
                  </p>
                  <CommercialCardSetup accountId={account.id} />
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="prose prose-sm max-w-none text-gray-600 mb-6 max-h-80 overflow-y-auto border border-gray-100 rounded-xl p-4 bg-white">
                <h2 className="text-sm font-bold text-[#0D2240]">Terms of Service</h2>
                <p>
                  This Commercial Laundry Service Agreement ("Agreement") is entered into between {businessName}
                  ("Service Provider") and {account.business_name} ("Customer"), effective as of the date of signature below.
                </p>
                <p><strong>1. Scope of Service.</strong> Service Provider agrees to provide recurring commercial wash-and-fold
                  laundry pickup and delivery service to Customer at the address on file, on a schedule agreed upon between the parties.</p>
                <p><strong>2. Pricing.</strong> Service will be billed
                  {account.rate_amount_cents != null ? ` at $${(account.rate_amount_cents / 100).toFixed(2)} ${rateLabel}` : " at the rate agreed upon separately"}.
                  {account.minimum_amount_cents != null && ` A minimum charge of $${(account.minimum_amount_cents / 100).toFixed(2)} per service applies.`}
                  {" "}Pricing is subject to change with 30 days' written notice. Condition of items will be evaluated at processing, and
                  Customer will be contacted if any additional fees apply.</p>
                <p><strong>3. Billing &amp; Payment.</strong> There is no posterior invoicing — every order is processed and charged to
                  the payment method on file, automatically, once the order is weighed. A valid payment method must be kept on file for
                  the duration of this Agreement, and Customer authorizes Service Provider to charge it for each order without a separate
                  invoice or approval step. You may find a record of prior processed invoices in your commercial account dashboard.</p>
                <p><strong>4. Term &amp; Termination.</strong> This Agreement remains in effect until terminated by either party with
                  at least 14 days' written notice. Either party may terminate immediately in the event of a material breach.</p>
                <p><strong>5. Liability.</strong> Service Provider will exercise reasonable care in handling Customer's items.</p>

                <p><strong>6. Conditions.</strong></p>
                <p>
                  We exercise utmost care in processing articles entrusted to us and use such processes which, in our opinion, are best suited
                  to the nature and condition of each individual article. Nevertheless, we cannot assume responsibility for inherent weaknesses
                  of or defects in materials that are not readily apparent prior to processing. This applies particularly, but not exclusively,
                  to suedes, leathers, silks, satins, double-faced fabrics, vinyls, polyurethanes, etc. Responsibility also is disclaimed for
                  trimmings, buckles, beads, buttons, bells and sequins. In laundering we cannot guarantee against color loss and shrinkage, or
                  against damage to weak and tender fabrics. Differences in count must be reported.
                  Unless a list accompanied the bundle, our count must be accepted. The company's liability with respect to any lost or damaged
                  article shall not exceed 3 times our charge for processing it.
                </p>
                <p>
                  Conditions of the items will be evaluated and the commercial customer contacted if any additional fees for processing apply.
                  We cannot guarantee that any stains will get removed.
                </p>

                <p><strong>7. Signature.</strong> By typing your name below and checking the confirmation box, you agree that this
                  constitutes a valid electronic signature binding {account.business_name} to the terms of this Agreement. A payment method
                  on file is required immediately after signing to complete setup of this account.</p>
              </div>

              <SignAgreementForm code={code} action={signCommercialAgreement} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
