"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { getLocationId } from "@/lib/location"
import type { Route, TimeWindow } from "@/lib/route-availability"
import { requireAdmin } from "@/lib/auth-guard"

/**
 * Returns all active routes from the DB, each with their time_windows embedded.
 * Called on mount in booking forms to drive calendar + time slot availability.
 */
export async function getActiveRoutes(): Promise<Route[]> {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]

  const { data: routes, error } = await supabase
    .from("routes")
    .select("id, name, pickup_days, delivery_days, recurrence, biweekly_start_date, turnaround_days, active, facility_id")
    .eq("location_id", locationId)
    .eq("active", true)
    .order("created_at", { ascending: true })

  if (error || !routes) {
    console.error("getActiveRoutes error:", error)
    return []
  }

  // Load all time windows for these routes in one query
  const routeIds = routes.map(r => r.id)
  const { data: windows } = await supabase
    .from("route_time_windows")
    .select("*")
    .in("route_id", routeIds)
    .eq("is_private", false)
    .order("sort_order", { ascending: true })
    .order("start_time", { ascending: true })

  const windowsByRoute: Record<string, TimeWindow[]> = {}
  for (const w of (windows ?? [])) {
    if (!windowsByRoute[w.route_id]) windowsByRoute[w.route_id] = []
    windowsByRoute[w.route_id].push(w as TimeWindow)
  }

  return routes.map(r => ({
    ...r,
    turnaround_days: r.turnaround_days ?? 3,
    time_windows: windowsByRoute[r.id] ?? [],
  })) as Route[]
}

/**
 * Returns ALL routes (active + inactive) with their time windows.
 * Used by the admin routes page.
 */
export async function getAllRoutesWithWindows(): Promise<Route[]> {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]

  const { data: routes, error } = await supabase
    .from("routes")
    .select("*")
    .eq("location_id", locationId)
    .order("created_at", { ascending: true })

  if (error || !routes) return []

  const routeIds = routes.map(r => r.id)
  const { data: windows } = await supabase
    .from("route_time_windows")
    .select("*")
    .in("route_id", routeIds)
    .order("sort_order", { ascending: true })
    .order("start_time", { ascending: true })

  const windowsByRoute: Record<string, TimeWindow[]> = {}
  for (const w of (windows ?? [])) {
    if (!windowsByRoute[w.route_id]) windowsByRoute[w.route_id] = []
    windowsByRoute[w.route_id].push(w as TimeWindow)
  }

  return routes.map(r => ({
    ...r,
    turnaround_days: r.turnaround_days ?? 3,
    time_windows: windowsByRoute[r.id] ?? [],
  })) as Route[]
}

// ── Time window CRUD ─────────────────────────────────────────────────────────

export async function createRouteTimeWindow(
  routeId: string,
  startTime: string,
  endTime: string,
  label: string,
  maxBookings: number | null,
  isPrivate: boolean,
  windowType: 'both' | 'pickup_only' | 'delivery_only' = 'both'
): Promise<{
  await requireAdmin()
 error?: string }> {
  const supabase = createAdminClient()

  // Get current max sort_order for this route
  const { data: existing } = await supabase
    .from("route_time_windows")
    .select("sort_order")
    .eq("route_id", routeId)
    .order("sort_order", { ascending: false })
    .limit(1)

  const nextSort = existing?.length ? (existing[0].sort_order + 1) : 0

  const { error } = await supabase.from("route_time_windows").insert({
    route_id:     routeId,
    start_time:   startTime,
    end_time:     endTime,
    label,
    max_bookings: maxBookings,
    is_private:   isPrivate,
    sort_order:   nextSort,
    window_type:  windowType,
  })

  if (error) return { error: error.message }
  revalidatePath("/admin/routes")
  return {}
}

export async function deleteRouteTimeWindow(windowId: string): Promise<void> {
  await requireAdmin()

  const supabase = createAdminClient()
  await supabase.from("route_time_windows").delete().eq("id", windowId)
  revalidatePath("/admin/routes")
}
