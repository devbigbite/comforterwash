import { requireAdmin } from "@/lib/auth-guard"
import { ManualContent } from "@/components/admin/docs/manual-content"

// Logged-in view of the tenant manual. Content lives in ManualContent (shared
// with the public /guide page, which prospects without an account can open)
// so the two never drift out of sync — this file only adds the auth check.
export default async function TenantManualPage() {
  await requireAdmin()
  return <ManualContent />
}
