import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import { revalidatePath } from "next/cache"
import { PartnerPortalClient } from "@/components/partner/PartnerPortalClient"

const OPERATOR_ZONE = ["at_facility", "in_washer", "in_dryer", "folded"]
const AT_FACILITY_STATUSES = ["at_facility", "in_washer", "in_dryer", "folded", "ready"]

async function markOrderReady(formData: FormData) {
  "use server"
  const bookingId    = formData.get("bookingId") as string
  const facilityCode = formData.get("facilityCode") as string
  const supabase     = createAdminClient()

  const { data: bags } = await supabase
    .from("order_bags")
    .select("id, status")
    .eq("booking_id", bookingId)
    .in("status", OPERATOR_ZONE)

  if (!bags?.length) return

  await supabase
    .from("order_bags")
    .update({ status: "ready" })
    .eq("booking_id", bookingId)
    .in("status", OPERATOR_ZONE)

  await supabase.from("order_events").insert({
    booking_id:  bookingId,
    event_type:  "ready_for_delivery",
    notes:       `Marked ready by facility partner (${bags.length} bag${bags.length === 1 ? "" : "s"})`,
    created_by:  "partner_attendant",
  })

  revalidatePath(`/partner/${facilityCode}`)
}

export default async function PartnerPortalPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase  = createAdminClient()

  // Facility lookup
  const { data: facility } = await supabase
    .from("facilities")
    .select("id, name, address, phone, manager, owner, rate_per_lb, minimum_lbs, supports_partner_attendant, supports_own_operator, partner_access_code")
    .eq("partner_access_code", code)
    .eq("active", true)
    .single()

  if (!facility) notFound()

  // ── Currently at facility ──────────────────────────────────────────────────
  const { data: activeBookings } = await supabase
    .from("bookings")
    .select(`
      id, service_type, delivery_date, actual_weight_lbs,
      facility_processing_mode,
      order_bags(id, status, bag_number, label_code)
    `)
    .eq("assigned_facility_id", facility.id)
    .in("status", AT_FACILITY_STATUSES)
    .order("delivery_date", { ascending: true })

  // ── Billing history — all completed orders at this facility ──────────────────
  const { data: historyBookings } = await supabase
    .from("bookings")
    .select("id, service_type, delivery_date, actual_weight_lbs, facility_cost_cents, status, created_at")
    .eq("assigned_facility_id", facility.id)
    .in("status", ["ready_at_warehouse", "out_for_delivery", "delivered"])
    .not("actual_weight_lbs", "is", null)
    .order("delivery_date", { ascending: false })

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })

  return (
    <PartnerPortalClient
      facility={facility}
      activeBookings={activeBookings ?? []}
      historyBookings={historyBookings ?? []}
      today={today}
      facilityCode={code}
      markOrderReadyAction={markOrderReady}
    />
  )
}
