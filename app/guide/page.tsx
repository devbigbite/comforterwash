import type { Metadata } from "next"
import { ManualContent } from "@/components/admin/docs/manual-content"

// Public, ungated copy of the tenant manual — for prospects who don't have an
// account yet (e.g. a link sent in a demo/follow-up email). No requireAdmin()
// here on purpose: this must be openable by anyone with the link. Content is
// generic/evergreen (no tenant-specific data), shared with the logged-in
// /admin/manual page via ManualContent so both stay in sync.
export const metadata: Metadata = {
  title: "Platform Guide — WashFoldClean",
  description: "A complete walkthrough of the WashFoldClean platform: admin (Simple & Advanced), the Driver and Operator apps, and the customer booking site.",
}

export default function PublicGuidePage() {
  return <ManualContent />
}
