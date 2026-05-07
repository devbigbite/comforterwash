"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export interface TimePunch {
  id: string
  worker_name: string
  role: string
  clocked_in_at: string
  clocked_out_at: string | null
  break_minutes: number
  notes: string | null
}

export interface ScheduledShift {
  id: string
  worker_name: string
  role: string
  shift_date: string
  start_time: string
  end_time: string
  notes: string | null
}

export interface ActiveWorker {
  id: string
  name: string
  roles: string[]
  hourly_wage_cents: number
}



// ── Workers ───────────────────────────────────────────────────────────────────

export async function getActiveWorkers(): Promise<ActiveWorker[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("workers")
    .select("id, name, roles, hourly_wage_cents")
    .eq("status", "active")
    .order("name")
  return (data ?? []) as ActiveWorker[]
}

// ── Clock in / out ────────────────────────────────────────────────────────────

/** Returns the open punch for a worker if they're currently clocked in */
export async function getOpenPunch(workerName: string): Promise<TimePunch | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("staff_time_punches")
    .select("*")
    .eq("worker_name", workerName)
    .is("clocked_out_at", null)
    .order("clocked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as TimePunch | null) ?? null
}

export async function clockIn(formData: FormData) {
  const supabase    = createAdminClient()
  const workerName  = formData.get("workerName") as string
  const role        = formData.get("role")        as string
  const notes       = (formData.get("notes") as string) || null

  if (!workerName || !role) return { error: "Missing required fields" }

  // Prevent double clock-in
  const existing = await getOpenPunch(workerName)
  if (existing) return { error: "Already clocked in" }

  const { data, error } = await supabase
    .from("staff_time_punches")
    .insert({ worker_name: workerName, role, notes })
    .select()
    .single()

  if (error) return { error: "Failed to clock in" }

  revalidatePath("/admin/schedule")
  revalidatePath("/staff")
  return { punch: data as TimePunch }
}

export async function clockOut(formData: FormData) {
  const supabase      = createAdminClient()
  const punchId       = formData.get("punchId")      as string
  const breakMinutes  = parseInt(formData.get("breakMinutes") as string || "0", 10)
  const notes         = (formData.get("notes") as string) || null

  if (!punchId) return { error: "Missing punch ID" }

  const { error } = await supabase
    .from("staff_time_punches")
    .update({
      clocked_out_at: new Date().toISOString(),
      break_minutes:  isNaN(breakMinutes) ? 0 : breakMinutes,
      ...(notes ? { notes } : {}),
    })
    .eq("id", punchId)
    .is("clocked_out_at", null)

  if (error) return { error: "Failed to clock out" }

  revalidatePath("/admin/schedule")
  revalidatePath("/staff")
  return { success: true }
}

// ── Current attendance ────────────────────────────────────────────────────────

/** All workers currently clocked in (open punches) */
export async function getCurrentPunches(): Promise<TimePunch[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("staff_time_punches")
    .select("*")
    .is("clocked_out_at", null)
    .order("clocked_in_at", { ascending: true })
  return (data ?? []) as TimePunch[]
}

// ── Time sheet ────────────────────────────────────────────────────────────────

/** Punches in a date range (inclusive). dateFrom/dateTo are YYYY-MM-DD strings. */
export async function getTimeSheet(
  dateFrom: string,
  dateTo: string
): Promise<TimePunch[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("staff_time_punches")
    .select("*")
    .gte("clocked_in_at", `${dateFrom}T00:00:00`)
    .lte("clocked_in_at", `${dateTo}T23:59:59`)
    .order("clocked_in_at", { ascending: false })
  return (data ?? []) as TimePunch[]
}

// ── Scheduled shifts ──────────────────────────────────────────────────────────

export async function getShiftsForWeek(weekStart: string): Promise<ScheduledShift[]> {
  const supabase  = createAdminClient()
  // weekStart is YYYY-MM-DD (Monday); weekEnd is 6 days later (Sunday)
  const start     = new Date(weekStart)
  const end       = new Date(weekStart)
  end.setDate(end.getDate() + 6)
  const weekEnd   = end.toISOString().split("T")[0]

  const { data } = await supabase
    .from("staff_scheduled_shifts")
    .select("*")
    .gte("shift_date", weekStart)
    .lte("shift_date", weekEnd)
    .order("shift_date")
    .order("start_time")
  return (data ?? []) as ScheduledShift[]
}

export async function createShift(formData: FormData) {
  const supabase    = createAdminClient()
  const workerName  = formData.get("workerName")  as string
  const role        = formData.get("role")         as string
  const shiftDate   = formData.get("shiftDate")    as string
  const startTime   = formData.get("startTime")    as string
  const endTime     = formData.get("endTime")      as string
  const notes       = (formData.get("notes") as string) || null

  if (!workerName || !role || !shiftDate || !startTime || !endTime) {
    return { error: "Missing required fields" }
  }

  const { data, error } = await supabase
    .from("staff_scheduled_shifts")
    .insert({ worker_name: workerName, role, shift_date: shiftDate, start_time: startTime, end_time: endTime, notes })
    .select()
    .single()

  if (error) return { error: "Failed to create shift" }

  revalidatePath("/admin/schedule")
  return { shift: data as ScheduledShift }
}

export async function deleteShift(shiftId: string) {
  const supabase = createAdminClient()
  await supabase.from("staff_scheduled_shifts").delete().eq("id", shiftId)
  revalidatePath("/admin/schedule")
}

// ── Admin: edit a punch (manual correction) ──────────────────────────────────
export async function updatePunch(formData: FormData) {
  const supabase       = createAdminClient()
  const punchId        = formData.get("punchId")        as string
  const clockedInAt    = formData.get("clockedInAt")    as string
  const clockedOutAt   = (formData.get("clockedOutAt")  as string) || null
  const breakMinutes   = parseInt(formData.get("breakMinutes") as string || "0", 10)

  if (!punchId || !clockedInAt) return { error: "Missing fields" }

  await supabase
    .from("staff_time_punches")
    .update({
      clocked_in_at:  clockedInAt,
      clocked_out_at: clockedOutAt || null,
      break_minutes:  isNaN(breakMinutes) ? 0 : breakMinutes,
    })
    .eq("id", punchId)

  revalidatePath("/admin/schedule")
  return { success: true }
}
