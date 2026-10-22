import { createAdminClient } from "@/lib/supabase/admin"
import { notFound, redirect } from "next/navigation"
import { isAdminForCurrentLocation } from "@/lib/auth-guard"
import { getLocationId, getLocation } from "@/lib/location"
import LabelsClient from "./labels-client"

export default async function PrintLabelsPage({ params }: { params: Promise<{ id: string }> }) {
  // Unlike every other /admin/** page, this one queried booking/order data
  // directly with no admin check at all — reachable by anyone who knew or
  // guessed a booking id, logged in or not. Add the same guard used
  // everywhere else instead of leaving it open.
  if (!(await isAdminForCurrentLocation())) redirect("/admin/login")

  const { id } = await params
  const supabase = createAdminClient()
  const locationId = await getLocationId()
  const location = await getLocation()

  // The admin auth check above only proves the visitor is an admin for
  // SOME tenant -- it never confirmed this booking id actually belongs to
  // that tenant. Without this, one tenant's admin could view and print
  // another tenant's shipping labels (customer name, order contents) just
  // by knowing or guessing a booking id.
  const { data: booking } = await supabase.from("bookings").select("*").eq("id", id).eq("location_id", locationId).single()
  if (!booking) notFound()

  const { data: bags } = await supabase
    .from("order_bags")
    .select("*")
    .eq("booking_id", id)
    .order("bag_number")

  const orderCode = booking.id.slice(0, 8).toUpperCase()
  const serviceLabel = booking.service_type === "wash_fold" ? "Wash & Fold" : "Comforter Wash"
  const deliveryDate = booking.delivery_date ?? ""

  return (
    <LabelsClient
      orderId={id}
      orderCode={orderCode}
      customerName={booking.customer_name ?? ""}
      serviceLabel={serviceLabel}
      brand={location?.business_name || "WashFold"}
      dueDate={deliveryDate}
      bags={(bags ?? []).map(b => ({ id: b.id as string, bag_number: b.bag_number as number, label_code: b.label_code as string }))}
    />
  )
}
