import { notFound } from "next/navigation"
import { getCommercialAccountByCode, signCommercialAgreement } from "@/app/actions/commercial-accounts"
import { SignAgreementForm } from "./sign-form"
import CommercialCardSetup from "@/components/commercial-card-setup"

export default async function CommercialAgreementPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const account = await getCommercialAccountByCode(code)
  if (!account) notFound()

  const rateLabel =
    account.rate_type === "per_lb" ? "per pound" :
    account.rate_type === "per_load" ? "per load" : "flat rate"

  return (
    <div className="min-h-screen bg-[#f7f8fb] py-10 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-extrabold text-[#0D2240]">Commercial Laundry Service Agreement</h1>
            <p className="text-sm text-gray-400 mt-1">WashFold Orlando · Commercial Recurring Service</p>
          </div>

          <div className="rounded-xl bg-[#f7f8fb] border border-gray-100 p-4 mb-6 text-sm text-[#0D2240] space-y-1">
            <p><span className="font-bold">Business:</span> {account.business_name}</p>
            {account.address && <p><span className="font-bold">Address:</span> {account.address}</p>}
            {account.contact_name && <p><span className="font-bold">Contact:</span> {account.contact_name}</p>}
            <p><span className="font-bold">Billing Frequency:</span> {account.billing_frequency}</p>
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
                <div className="rounded-xl bg-green-50 border border-green-200 p-5 text-center">
                  <p className="font-bold text-green-700">✅ Payment method on file</p>
                  <p className="text-sm text-green-700/80 mt-1">
                    {account.card_brand ? `${account.card_brand.toUpperCase()} ` : ""}
                    {account.card_last4 ? `ending in ${account.card_last4}` : "Card saved"}
                  </p>
                </div>
              ) : (
                <div>
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
                  This Commercial Laundry Service Agreement ("Agreement") is entered into between WashFold Orlando
                  ("Service Provider") and {account.business_name} ("Customer"), effective as of the date of signature below.
                </p>
                <p><strong>1. Scope of Service.</strong> Service Provider agrees to provide recurring commercial wash-and-fold
                  laundry pickup and delivery service to Customer at the address on file, on a {account.billing_frequency} basis,
                  subject to the schedule agreed upon between the parties.</p>
                <p><strong>2. Pricing.</strong> Service will be billed
                  {account.rate_amount_cents != null ? ` at $${(account.rate_amount_cents / 100).toFixed(2)} ${rateLabel}` : " at the rate agreed upon separately"}.
                  {account.minimum_amount_cents != null && ` A minimum charge of $${(account.minimum_amount_cents / 100).toFixed(2)} per service applies.`}
                  {" "}Pricing is subject to change with 30 days' written notice.</p>
                <p><strong>3. Billing &amp; Payment.</strong> Invoices will be issued on a {account.billing_frequency} basis and are due
                  within 15 days of the invoice date. Late payments may result in suspension of service.</p>
                <p><strong>4. Term &amp; Termination.</strong> This Agreement remains in effect until terminated by either party with
                  at least 14 days' written notice. Either party may terminate immediately in the event of a material breach.</p>
                <p><strong>5. Liability.</strong> Service Provider will exercise reasonable care in handling Customer's items.
                  Service Provider's liability for any lost or damaged items is limited to the reasonable replacement cost of the
                  affected items, not to exceed the value of the applicable service charge.</p>
                <p><strong>6. Signature.</strong> By typing your name below and checking the confirmation box, you agree that this
                  constitutes a valid electronic signature binding {account.business_name} to the terms of this Agreement.</p>
              </div>

              <SignAgreementForm code={code} action={signCommercialAgreement} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
