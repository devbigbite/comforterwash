import { createAdminClient } from "@/lib/supabase/admin"
import { RoutingClient } from "./routing-client"

export default async function RoutingPage() {
  const supabase = createAdminClient()

  const [{ data: rawOrders }, { data: facilities }] = await Promise.all([
    supabase
      .from("bookings")
      .select(`
        id, short_code, customer_name, service_type,
        pickup_date, status, actual_weight_lbs, num_bags,
        assigned_facility_id,
        facilities:assigned_facility_id ( name )
      `)
      .in("status", ["confirmed", "picked_up", "at_warehouse", "at_facility"])
      .order("pickup_date", { ascending: true }),
    supabase
      .from("facilities")
      .select("id, name, processing_mode, rate_per_lb, minimum_lbs")
      .eq("active", true)
      .order("name"),
  ])

  // Flatten the joined facility name
  const orders = (rawOrders ?? []).map((o: Record<string, unknown>) => ({
    id:                   o.id as string,
    short_code:           o.short_code as string,
    customer_name:        o.customer_name as string,
    service_type:         o.service_type as string,
    pickup_date:          o.pickup_date as string | null,
    status:               o.status as string,
    actual_weight_lbs:    o.actual_weight_lbs as number | null,
    num_bags:             o.num_bags as number | null,
    assigned_facility_id: o.assigned_facility_id as string | null,
    facility_name:        (o.facilities as { name: string } | null)?.name ?? null,
  }))

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-[#0D2240]">Facility Routing</h1>
        <p className="text-sm text-gray-400 mt-1">
          Select orders and assign them to a facility in bulk.
          Arrival notifications are sent automatically when a driver completes a drop-off run.
        </p>
      </div>
      <RoutingClient orders={orders} facilities={facilities ?? []} />
    </div>
  )
}
