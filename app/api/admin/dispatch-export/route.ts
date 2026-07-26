import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"

// Plain-CSV manifest of a day's pickups & deliveries — the no-Shipday
// alternative. Opens directly in Excel, Google Sheets, or Numbers, so a
// tenant who doesn't want a Shipday subscription can still hand their
// driver(s) a printable/emailable route sheet for the day.
//
// Deliberately CSV, not a real .xlsx binary — every spreadsheet app opens
// CSV natively, and it avoids adding a binary-writing dependency for what
// is fundamentally a flat table.

const SERVICE_LABEL: Record<string, string> = {
  comforter_wash: "Comforter Wash",
  wash_fold: "Wash & Fold",
  wash_only: "Wash Only",
}

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(req: NextRequest) {
  await requireAdmin()

  const url = new URL(req.url)
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date())
  const date = url.searchParams.get("date") || today

  const supabase = createAdminClient()
  const locationId = await getLocationId()

  const { data } = await supabase
    .from("bookings")
    .select(`
      short_code, customer_name, customer_address, customer_phone,
      pickup_date, pickup_time_window, delivery_date, delivery_time_window,
      service_type, num_bags, num_comforters, status,
      assigned_driver:workers!assigned_driver_id(name)
    `)
    .eq("location_id", locationId)
    .or(`pickup_date.eq.${date},delivery_date.eq.${date}`)
    .neq("status", "cancelled")
    .order("pickup_time_window")

  type Row = {
    short_code: string | null
    customer_name: string
    customer_address: string
    customer_phone: string
    pickup_date: string
    pickup_time_window: string
    delivery_date: string
    delivery_time_window: string
    service_type: string
    num_bags: number | null
    num_comforters: number | null
    status: string
    assigned_driver: { name: string } | null
  }

  const bookings = (data ?? []) as unknown as Row[]

  const header = [
    "Stop Type", "Time Window", "Order #", "Customer", "Phone", "Address",
    "Service", "Bags", "Comforters", "Status", "Driver",
  ]

  const lines = [header.map(csvEscape).join(",")]

  for (const b of bookings) {
    const size = b.num_comforters ? `${b.num_comforters} comforter(s)` : b.num_bags ? `${b.num_bags} bag(s)` : ""
    const driver = b.assigned_driver?.name ?? ""
    const service = SERVICE_LABEL[b.service_type] ?? b.service_type

    if (b.pickup_date === date) {
      lines.push([
        "Pickup", b.pickup_time_window, b.short_code ?? "", b.customer_name, b.customer_phone,
        b.customer_address, service, b.num_bags ?? "", b.num_comforters ?? "", b.status, driver,
      ].map(csvEscape).join(","))
    }
    if (b.delivery_date === date) {
      lines.push([
        "Delivery", b.delivery_time_window, b.short_code ?? "", b.customer_name, b.customer_phone,
        b.customer_address, service, b.num_bags ?? "", b.num_comforters ?? "", b.status, driver,
      ].map(csvEscape).join(","))
    }
  }

  const csv = "﻿" + lines.join("\r\n") // BOM so Excel renders UTF-8 accents correctly

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dispatch-${date}.csv"`,
    },
  })
}
