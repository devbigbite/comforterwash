import { requireAdmin } from "@/lib/auth-guard"
import { getReceiptText } from "@/app/actions/settings"
import { ReceiptTextForm } from "@/components/admin/receipt-text-form"

export const dynamic = "force-dynamic"

export default async function ReceiptTextAdminPage() {
  await requireAdmin()
  const text = await getReceiptText()

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0D2240]">Receipt Text</h1>
        <p className="text-sm text-gray-500 mt-1">
          The wording printed on every bag receipt — thermal printer and the on-screen preview both use this. No
          price is ever printed on a receipt, so nothing here relates to pricing.
        </p>
      </div>
      <ReceiptTextForm initial={text} />
    </div>
  )
}
