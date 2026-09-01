import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth-guard"
import { AddCityForm } from "./add-city-form"

export const dynamic = "force-dynamic"

export default async function CitiesPage() {
  await requireAdmin()

  const authed = await createClient()
  const { data: { user } } = await authed.auth.getUser()

  const admin = createAdminClient()
  const { data: memberships } = user
    ? await admin.from("location_users").select("location_id").eq("user_id", user.id)
    : { data: null }

  const locationIds = Array.from(new Set((memberships ?? []).map(m => m.location_id)))
  const { data: cities } = locationIds.length
    ? await admin
        .from("locations")
        .select("id, business_name, name, slug, address, timezone, billing_status")
        .in("id", locationIds)
        .order("name")
    : { data: [] }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-10">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-[#0D2240]">Cities</h1>
            <p className="text-sm text-gray-400 mt-1">
              Run this business in more than one city. Each city has its own fully separate data
              (orders, service area, drivers) and its own billing line — same login switches between them.
            </p>
          </div>
          <a href="/admin" className="text-sm text-gray-400 hover:text-[#0D2240] transition-colors">
            ← Back to Dashboard
          </a>
        </div>

        {/* Existing cities */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          {!cities || cities.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">No cities yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-[#f7f8fb]">
                  <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">City</th>
                  <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Address</th>
                  <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Billing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cities.map(city => (
                  <tr key={city.id}>
                    <td className="px-6 py-4 font-bold text-[#0D2240]">{city.business_name ?? city.name}</td>
                    <td className="px-6 py-4 text-gray-500">{city.address ?? "—"}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                        city.billing_status === "active"
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                        {city.billing_status === "active" ? "Active" : city.billing_status === "none" ? "Awaiting setup" : city.billing_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add a city */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-bold text-[#0D2240] mb-1">Add a City</h2>
          <p className="text-xs text-gray-400 mb-4">
            Creates a new, fully separate location for this business in another city. After it's created,
            we'll set a monthly price for it and send you a checkout link to start billing — same as when
            this account was first set up.
          </p>
          <AddCityForm />
        </div>

      </div>
    </div>
  )
}
