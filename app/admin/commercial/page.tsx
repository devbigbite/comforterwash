import { requireAdmin } from "@/lib/auth-guard"
import {
  getCommercialAccounts, getCommercialInvoices,
  addCommercialAccount, updateCommercialAccount, toggleCommercialAccountStatus,
  deleteCommercialAccount, issueCommercialInvoice, createCommercialOrder,
  sendCommercialAccountInvite,
  type CommercialAccount,
} from "@/app/actions/commercial-accounts"
import { AgreementLinkCopy } from "@/components/admin/AgreementLinkCopy"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://comforterwash.com"
function agreementLink(accessCode: string): string {
  return `${SITE_URL}/commercial-agreement/${accessCode}`
}

const inp = "rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 bg-white w-full"

const STATUS_STYLE: Record<string, string> = {
  pending:   "bg-yellow-50 text-yellow-700 border-yellow-200",
  active:    "bg-green-50 text-green-700 border-green-200",
  paused:    "bg-gray-100 text-gray-500 border-gray-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
}

function AccountFields({ a }: { a?: CommercialAccount }) {
  const val = (k: keyof CommercialAccount) => a ? String(a[k] ?? "") : ""
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Business Name *</label>
          <input name="business_name" required defaultValue={val("business_name")} placeholder="Sunrise Diner" className={inp} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Address</label>
          <input name="address" defaultValue={val("address")} placeholder="123 Main St, Orlando FL" className={inp} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact Name</label>
          <input name="contact_name" defaultValue={val("contact_name")} placeholder="Maria Rodriguez" className={inp} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact Email</label>
          <input name="contact_email" type="email" defaultValue={val("contact_email")} placeholder="ap@sunrisediner.com" className={inp} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact Phone</label>
          <input name="contact_phone" type="tel" defaultValue={val("contact_phone")} placeholder="(407) 555-0100" className={inp} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Billing Frequency</label>
          <select name="billing_frequency" defaultValue={val("billing_frequency") || "monthly"} className={inp}>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Rate Type</label>
          <select name="rate_type" defaultValue={val("rate_type") || "per_lb"} className={inp}>
            <option value="per_lb">Per Pound</option>
            <option value="flat">Flat Rate</option>
            <option value="per_load">Per Load</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Rate ($)</label>
          <input name="rate_amount" type="number" step="0.01"
            defaultValue={a?.rate_amount_cents != null ? (a.rate_amount_cents / 100).toFixed(2) : ""}
            placeholder="1.25" className={inp} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Minimum ($)</label>
          <input name="minimum_amount" type="number" step="0.01"
            defaultValue={a?.minimum_amount_cents != null ? (a.minimum_amount_cents / 100).toFixed(2) : ""}
            placeholder="50.00" className={inp} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Notes</label>
        <input name="notes" defaultValue={val("notes")} placeholder="Pickup instructions, contract details…" className={inp} />
      </div>
    </>
  )
}

export default async function CommercialAccountsPage() {
  await requireAdmin()
  const accounts = await getCommercialAccounts()
  const invoicesByAccount: Record<string, Awaited<ReturnType<typeof getCommercialInvoices>>> = {}
  for (const a of accounts) {
    invoicesByAccount[a.id] = await getCommercialInvoices(a.id)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-[#0D2240]">Commercial Accounts</h1>
        <p className="text-sm text-gray-400 mt-1">
          {accounts.filter(a => a.status === "active").length} active · {accounts.length} total
        </p>
      </div>

      {/* Send signup invite — business fills in the rest themselves */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 space-y-4">
        <div>
          <h2 className="font-bold text-[#0D2240]">✉️ Send Signup Invite</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Quicker option — email a link and the business fills in their own contact details, signs the agreement, and adds a card. Set a rate here if you already know it, or leave it blank and fill it in later.
          </p>
        </div>
        <form action={sendCommercialAccountInvite} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Business Name *</label>
              <input name="business_name" required placeholder="Sunrise Diner" className={inp} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact Email *</label>
              <input name="contact_email" type="email" required placeholder="ap@sunrisediner.com" className={inp} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact Name</label>
              <input name="contact_name" placeholder="Maria Rodriguez" className={inp} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact Phone</label>
              <input name="contact_phone" type="tel" placeholder="(407) 555-0100" className={inp} />
            </div>
          </div>
          <details className="group">
            <summary className="cursor-pointer text-xs font-semibold text-gray-400 hover:text-[#0D2240] transition-colors list-none select-none">
              <span className="group-open:hidden">+ Set a rate now (optional)</span>
              <span className="hidden group-open:inline">− Hide rate fields</span>
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Rate Type</label>
                <select name="rate_type" defaultValue="per_lb" className={inp}>
                  <option value="per_lb">Per Pound</option>
                  <option value="flat">Flat Rate</option>
                  <option value="per_load">Per Load</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Rate ($)</label>
                <input name="rate_amount" type="number" step="0.01" placeholder="1.25" className={inp} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Minimum ($)</label>
                <input name="minimum_amount" type="number" step="0.01" placeholder="50.00" className={inp} />
              </div>
            </div>
          </details>
          <div className="flex justify-end">
            <button type="submit" className="rounded-xl bg-[#0D2240] text-white font-bold text-sm px-6 py-2.5 hover:bg-[#16305c] transition-colors">
              ✉️ Send Invite Email
            </button>
          </div>
        </form>
      </div>

      {/* Add account manually */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 space-y-4">
        <details className="group">
          <summary className="cursor-pointer list-none select-none flex items-center justify-between">
            <h2 className="font-bold text-[#0D2240]">Add Commercial Account Manually</h2>
            <span className="text-xs text-gray-400 group-open:hidden">expand ▾</span>
            <span className="text-xs text-gray-400 hidden group-open:inline">collapse ▴</span>
          </summary>
          <form action={addCommercialAccount} className="space-y-4 mt-4">
            <AccountFields />
            <div className="flex justify-end">
              <button type="submit" className="rounded-xl bg-[#E8726A] text-white font-bold text-sm px-6 py-2.5 hover:bg-[#d45f57] transition-colors">
                Add Account
              </button>
            </div>
          </form>
        </details>
      </div>

      {/* List */}
      <div className="space-y-3">
        {accounts.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center text-gray-400 text-sm border border-gray-100">
            No commercial accounts yet. Add your first one above.
          </div>
        ) : accounts.map(a => (
          <div key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#f7f8fb] border border-gray-100 flex items-center justify-center text-2xl shrink-0">🏢</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-[#0D2240]">{a.business_name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${STATUS_STYLE[a.status]}`}>
                    {a.status}
                  </span>
                  {a.agreement_signed_at ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border bg-blue-50 text-blue-700 border-blue-200">
                      ✅ Signed {new Date(a.agreement_signed_at).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border bg-gray-50 text-gray-400 border-gray-200">
                      Awaiting signature
                    </span>
                  )}
                  {a.agreement_signed_at && (
                    a.stripe_payment_method_id ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border bg-green-50 text-green-700 border-green-200">
                        💳 {a.card_brand ? `${a.card_brand.toUpperCase()} ` : ""}{a.card_last4 ? `••${a.card_last4}` : "Card on file"}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border bg-amber-50 text-amber-700 border-amber-200">
                        No card on file
                      </span>
                    )
                  )}
                </div>
                <div className="mt-1 space-y-0.5 text-sm text-gray-500">
                  {a.address && <p>📍 {a.address}</p>}
                  {a.contact_name && <p>{a.contact_name}{a.contact_phone ? ` · ${a.contact_phone}` : ""}{a.contact_email ? ` · ${a.contact_email}` : ""}</p>}
                  <p className="text-xs text-gray-400">
                    {a.billing_frequency} · {a.rate_type.replace("_", " ")}{a.rate_amount_cents ? ` · $${(a.rate_amount_cents / 100).toFixed(2)}` : ""}
                    {a.minimum_amount_cents ? ` · min $${(a.minimum_amount_cents / 100).toFixed(2)}` : ""}
                  </p>
                </div>
                {!a.agreement_signed_at && (
                  <div className="mt-2">
                    <AgreementLinkCopy url={agreementLink(a.access_code)} />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <form action={toggleCommercialAccountStatus}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="new_status" value={a.status === "active" ? "paused" : "active"} />
                  <button type="submit" disabled={!a.agreement_signed_at}
                    className="text-xs font-bold text-gray-500 border border-gray-200 bg-white px-3 py-1.5 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-30">
                    {a.status === "active" ? "Pause" : "Activate"}
                  </button>
                </form>
                <form action={deleteCommercialAccount}>
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" className="text-xs font-bold text-red-400 border border-red-200 bg-white px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors">
                    Delete
                  </button>
                </form>
              </div>
            </div>

            {/* Billing accordion */}
            {a.agreement_signed_at && (
              <details className="group border-t border-gray-100">
                <summary className="cursor-pointer px-5 py-2.5 text-xs font-semibold text-gray-400 hover:text-[#0D2240] transition-colors list-none flex items-center gap-1.5 select-none">
                  <span className="group-open:hidden">💳 Billing ({(invoicesByAccount[a.id] ?? []).length} invoices)</span>
                  <span className="hidden group-open:inline">💳 Close billing</span>
                </summary>
                <div className="px-5 pb-5 pt-4 bg-[#f7f8fb] border-t border-gray-100 space-y-4">
                  <div className="border border-gray-200 rounded-xl p-4 bg-white">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Issue Invoice via Stripe</p>
                    <form action={issueCommercialInvoice} className="space-y-2">
                      <input type="hidden" name="account_id" value={a.id} />
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Amount ($)</label>
                          <input name="amount" type="number" step="0.01" required className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-[#0D2240] bg-white" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Period From</label>
                          <input name="period_from" type="date" className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-[#0D2240] bg-white" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Period To</label>
                          <input name="period_to" type="date" className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-[#0D2240] bg-white" />
                        </div>
                      </div>
                      <input name="notes" placeholder="Invoice description (optional)" className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-[#0D2240] bg-white" />
                      <button type="submit" className="w-full text-xs font-bold text-white bg-[#E8726A] hover:bg-[#d45f57] px-4 py-2 rounded-xl transition-colors uppercase tracking-wide">
                        💸 Send Invoice
                      </button>
                    </form>
                  </div>

                  {(invoicesByAccount[a.id] ?? []).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Invoice History</p>
                      <div className="space-y-1.5">
                        {(invoicesByAccount[a.id] ?? []).map(inv => (
                          <div key={inv.id} className="flex items-center gap-3 flex-wrap bg-white rounded-xl px-3 py-2 border border-gray-100 text-xs">
                            <span className="font-bold text-[#0D2240]">${(inv.amount_cents / 100).toFixed(2)}</span>
                            {inv.period_from && inv.period_to && <span className="text-gray-400">{inv.period_from} – {inv.period_to}</span>}
                            {inv.notes && <span className="text-gray-400">{inv.notes}</span>}
                            <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-50 text-yellow-700 border border-yellow-200">
                              {inv.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Create order accordion */}
            {a.agreement_signed_at && (
              <details className="group border-t border-gray-100">
                <summary className="cursor-pointer px-5 py-2.5 text-xs font-semibold text-gray-400 hover:text-[#0D2240] transition-colors list-none flex items-center gap-1.5 select-none">
                  <span className="group-open:hidden">📦 Create order</span>
                  <span className="hidden group-open:inline">📦 Close</span>
                </summary>
                <div className="px-5 pb-5 pt-4 bg-[#f7f8fb] border-t border-gray-100">
                  {!a.stripe_payment_method_id ? (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                      Add a card on file before creating orders — the commercial agreement link above includes a payment-method step.
                    </p>
                  ) : (
                    <form action={createCommercialOrder} className="space-y-2">
                      <input type="hidden" name="account_id" value={a.id} />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Pickup Date</label>
                          <input name="pickup_date" type="date" required className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-[#0D2240] bg-white" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Pickup Window</label>
                          <input name="pickup_time_window" placeholder="9:00 AM - 12:00 PM" className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-[#0D2240] bg-white" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Delivery Date</label>
                          <input name="delivery_date" type="date" className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-[#0D2240] bg-white" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Delivery Window</label>
                          <input name="delivery_time_window" placeholder="9:00 AM - 12:00 PM" className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-[#0D2240] bg-white" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Bags</label>
                          <input name="num_bags" type="number" min="1" defaultValue="1" className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-[#0D2240] bg-white" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Service Type</label>
                          <select name="service_type" defaultValue="wash_fold" className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-[#0D2240] bg-white">
                            <option value="wash_fold">Wash &amp; Fold</option>
                            <option value="wash_only">Wash Only</option>
                          </select>
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-400">
                        No charge happens now — the account&apos;s card on file is charged automatically once the order is weighed at the facility,
                        the same way a regular customer order flows through pickup, washing, and delivery.
                      </p>
                      <button type="submit" className="w-full text-xs font-bold text-white bg-[#0D2240] hover:bg-[#16305c] px-4 py-2 rounded-xl transition-colors uppercase tracking-wide">
                        📦 Create Order
                      </button>
                    </form>
                  )}
                </div>
              </details>
            )}

            {/* Edit accordion */}
            <details className="group border-t border-gray-100">
              <summary className="cursor-pointer px-5 py-2.5 text-xs font-semibold text-gray-400 hover:text-[#0D2240] transition-colors list-none flex items-center gap-1.5 select-none">
                <span className="group-open:hidden">✏️ Edit account</span>
                <span className="hidden group-open:inline">✏️ Close editor</span>
              </summary>
              <form action={updateCommercialAccount} className="px-5 pb-5 pt-4 bg-[#f7f8fb] space-y-4 border-t border-gray-100">
                <input type="hidden" name="id" value={a.id} />
                <AccountFields a={a} />
                <div className="flex justify-end">
                  <button type="submit" className="rounded-xl bg-[#E8726A] text-white font-bold text-sm px-6 py-2 hover:bg-[#d45f57] transition-colors">
                    Save Changes
                  </button>
                </div>
              </form>
            </details>
          </div>
        ))}
      </div>
    </div>
  )
}
