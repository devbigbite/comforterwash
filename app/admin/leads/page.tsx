import { redirect } from "next/navigation"
import { getLeadSearches, getLeads } from "@/app/actions/leads"
import { isAdminForCurrentLocation } from "@/lib/auth-guard"
import { LeadSearchForm } from "./lead-search-form"
import { LeadsTable } from "./leads-table"

export const dynamic = "force-dynamic"

export default async function LeadsPage() {
  if (!(await isAdminForCurrentLocation())) redirect("/admin/login")

  const [searches, leads] = await Promise.all([getLeadSearches(), getLeads()])

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-[#0D2240]">Lead Finder</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Search for local businesses to pitch commercial laundry service to — spas, gyms, Airbnb property
          managers, mom groups, whatever category you want to target. Each search costs ScrapeGraphAI credits
          (roughly 30 credits for 3 results, +10 per additional result).
        </p>
      </div>

      <LeadSearchForm initialSearches={searches} />

      <div className="mt-10">
        <h2 className="text-lg font-extrabold text-[#0D2240] mb-3">
          Leads {leads.length > 0 && <span className="text-gray-400 font-semibold">({leads.length})</span>}
        </h2>
        <LeadsTable initialLeads={leads} />
      </div>
    </div>
  )
}
