import { redirect } from "next/navigation"
import { checkIsAdmin } from "@/app/admin/login/actions"
import OwnerLoginClient from "./owner-login-client"

/**
 * Deterministic Owner-session entry point for the operator app — reached
 * only via a link inside the already-authenticated /admin panel (see
 * /admin/print-station). Verifies the admin cookie server-side (so this
 * can't be used to self-grant access by just guessing the URL), then hands
 * off to a tiny client component that writes the Owner session to
 * localStorage and redirects into the app.
 *
 * This exists because the inline "Enter as Owner" option on the operator
 * PIN screen depends on a client-side admin check that can be flaky —
 * this route sidesteps that entirely.
 */
export default async function OwnerLoginPage() {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect("/admin/login")
  return <OwnerLoginClient />
}
