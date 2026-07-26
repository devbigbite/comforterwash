import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "WashFoldClean — Run Your Laundry Pickup & Delivery Business",
  description: "The all-in-one platform for laundry pickup & delivery businesses — your own branded booking site, admin dashboard, billing, driver dispatch, and more. Built for facilities and home-based operators alike.",
}

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return children
}
