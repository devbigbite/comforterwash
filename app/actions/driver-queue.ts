"use server"

import { createAdminClient } from "@/lib/supabase/admin"

export interface DriverOrder {
  id: string
  short_code: string | null
  customer_name: string
  customer_address: string
  pickup_date: string
  delivery_date: string
  status: string
  service_type: string
  num_bags: number
}

export async function getDriverQueue(driverId: string): Promise<{
  pickups: DriverOrder[]
  deliveries: DriverOrder[]
}> {
  if (!driverId || driverId === "owner") return { pickups: [], deliveries: [] }

  const supabase = createAdminClient()
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date())

  const [{ data: pickups }, { data: deliveries }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, short_code, customer_name, customer_address, pickup_date, delivery_date, status, service_type, num_bags")
      .eq("pickup_date", today)
      .in("status", ["confirmed", "picked_up"])
      .eq("assigned_driver_id", driverId)
      .order("pickup_date"),
    supabase
      .from("bookings")
      .select("id, short_code, customer_name, customer_address, pickup_date, delivery_date, status, service_type, num_bags")
      .eq("delivery_date", today)
      .in("status", ["ready", "ready_at_warehouse", "out_for_delivery"])
      .eq("assigned_driver_id", driverId)
      .order("delivery_date"),
  ])

  return {
    pickups:    (pickups    ?? []) as DriverOrder[],
    deliveries: (deliveries ?? []) as DriverOrder[],
  }
}
