"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import {
  SCHEDULE_GRACE_MINUTES,
  SCHEDULE_ALERT_EMAIL_ENABLED,
  SCHEDULE_ALERT_RECIPIENT,
} from "@/lib/staff-config"
import { sendScheduleAlertEmail } from "@/lib/email"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"

export interface TimePunch {
  id: string
  worker_name: string
  role: string
  clocked_in_at: string
  clocked_out_at: string | null
  break_minutes: number
  notes: string | null
  schedule_flag: "unscheduled" | "early_in" | "late_in" | "early_out" | "late_out" | null
  flag_minutes: number | null
}

export type ScheduleFlag = "unscheduled" | "early_in" | "late_in" | "early_out" | "late_out"

export interface ScheduleWarning {
  flag: ScheduleFlag
  flagMinutes: number
  scheduledTime: string | null   // e.g. "9:00 AM – 5:00 PM"
  message: string
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

// ── PIN management ────────────────────────────────────────────────────────────

/** Set or update a worker's 4-digit clock PIN (admin only). */
export async function setWorkerPin(workerName: string, pin: string) {
  await requireAdmin()

  if (!/^\d{4}$/.test(pin)) return { error: "PIN must be exactly 4 digits" }
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("workers")
    .update({ clock_pin: pin })
    .eq("name", workerName)
  if (error) return { error: "Failed to set PIN" }
  revalidatePath("/admin/workers")
  return { success: true }
}

/** Clear a worker's PIN (admin reset). */
export async function clearWorkerPin(workerName: string) {
  await requireAdmin()

  const supabase = createAdminClient()
  await supabase.from("workers").update({ clock_pin: null }).eq("name", workerName)
  revalidatePath("/admin/workers")
  return { success: true }
}

/** Set a worker's app language preference (admin). */
export async function setWorkerLang(workerId: string, lang: "en" | "es") {
  await requireAdmin()
  const supabase = createAdminClient()
  const { error } = await supabase.from("workers").update({ lang }).eq("id", workerId)
  if (error) return { error: "Failed to update language" }
  revalidatePath("/admin/workers")
  return { success: true }
}

/** Verify a worker's PIN. Returns true if correct or if no PIN is set yet. */
export async function verifyWorkerPin(workerName: string, pin: string): Promise<{ valid: boolean; noPinSet: boolean; lang: string }> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("workers")
    .select("clock_pin, lang")
    .eq("name", workerName)
    .single()
  if (!data) return { valid: false, noPinSet: false, lang: "en" }
  if (!data.clock_pin) return { valid: true, noPinSet: true, lang: data.lang ?? "en" }
  return { valid: data.clock_pin === pin, noPinSet: false, lang: data.lang ?? "en" }
}

/**
 * Verify a PIN against a specific role's worker roster.
 * Used by the driver/operator station PIN gate.
 * Returns the matched worker's id and name, or null if no match.
 */
export async function verifyWorkerPinForRole(
  role: "driver" | "operator",
  pin: string
): Promise<{ id: string; name: string; lang: string } | null> {
  if (!/^\d{4}$/.test(pin)) return null
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("workers")
    .select("id, name, clock_pin, lang")
    .eq("status", "active")
  if (!data) return null
  const match = data.find((w: { clock_pin: string | null }) => w.clock_pin === pin)
  if (!match) return null
  return { id: match.id, name: match.name, lang: match.lang ?? "en" }
}

// ── Schedule checking ─────────────────────────────────────────────────────────

function fmtTime(t: string): string {
  // "09:00" → "9:00 AM"
  const [hStr, mStr] = t.split(":")
  const h = parseInt(hStr, 10)
  const ampm = h >= 12 ? "PM" : "AM"
  return `${h % 12 || 12}:${mStr} ${ampm}`
}

/** Compare clock time to scheduled time. Returns flag + how many minutes off. */
function calcFlag(
  nowMins: number,
  scheduledMins: number,
  direction: "in" | "out"
): { flag: ScheduleFlag | null; flagMinutes: number } {
  const diff = nowMins - scheduledMins   // positive = late, negative = early
  if (Math.abs(diff) <= SCHEDULE_GRACE_MINUTES) return { flag: null, flagMinutes: 0 }
  if (direction === "in") {
    return diff > 0
      ? { flag: "late_in",  flagMinutes: diff }
      : { flag: "early_in", flagMinutes: Math.abs(diff) }
  } else {
    return diff < 0
      ? { flag: "early_out", flagMinutes: Math.abs(diff) }
      : { flag: "late_out",  flagMinutes: diff }
  }
}

function toMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number)
  return h * 60 + m
}

/** Check today's schedule for a worker+role. Returns a ScheduleWarning or null. */
async function checkSchedule(
  workerName: string,
  role: string,
  direction: "in" | "out",
  locationId: string
): Promise<{ warning: ScheduleWarning | null; scheduledShift: ScheduledShift | null }> {
  const supabase  = createAdminClient()
  const todayET   = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })
  const nowET     = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }))
  const nowMins   = nowET.getHours() * 60 + nowET.getMinutes()

  const { data: shifts } = await supabase
    .from("staff_scheduled_shifts")
    .select("*")
    .eq("location_id", locationId)
    .eq("worker_name", workerName)
    .eq("role", role)
    .eq("shift_date", todayET)
    .order("start_time")
    .limit(1)

  const shift = (shifts?.[0] ?? null) as ScheduledShift | null

  if (!shift) {
    return {
      warning: {
        flag: "unscheduled",
        flagMinutes: 0,
        scheduledTime: null,
        message: `You have no shift scheduled today. This will be flagged for review.`,
      },
      scheduledShift: null,
    }
  }

  const scheduledLabel = `${fmtTime(shift.start_time)} – ${fmtTime(shift.end_time)}`
  const refMins   = direction === "in" ? toMinutes(shift.start_time) : toMinutes(shift.end_time)
  const { flag, flagMinutes } = calcFlag(nowMins, refMins, direction)

  if (!flag) return { warning: null, scheduledShift: shift }

  const messages: Record<ScheduleFlag, string> = {
    unscheduled: "No shift scheduled today.",
    early_in:  `You're ${flagMinutes} min early (scheduled ${fmtTime(shift.start_time)}). This will be noted.`,
    late_in:   `You're ${flagMinutes} min late (scheduled ${fmtTime(shift.start_time)}). This will be noted.`,
    early_out: `You're clocking out ${flagMinutes} min early (scheduled until ${fmtTime(shift.end_time)}). This will be noted.`,
    late_out:  `You're clocking out ${flagMinutes} min late (scheduled until ${fmtTime(shift.end_time)}). This will be noted.`,
  }

  return {
    warning: { flag, flagMinutes, scheduledTime: scheduledLabel, message: messages[flag] },
    scheduledShift: shift,
  }
}

// ── Clock in / out ────────────────────────────────────────────────────────────

/** Returns the open punch for a worker if they're currently clocked in */
export async function getOpenPunch(workerName: string): Promise<TimePunch | null> {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase
    .from("staff_time_punches")
    .select("*")
    .eq("location_id", locationId)
    .eq("worker_name", workerName)
    .is("clocked_out_at", null)
    .order("clocked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as TimePunch | null) ?? null
}

export async function clockIn(formData: FormData) {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const workerName  = formData.get("workerName")     as string
  const role        = formData.get("role")            as string
  const notes       = (formData.get("notes") as string) || null
  // "confirmed" is set by the UI after the worker acknowledges a Level 2 warning
  const confirmed   = formData.get("confirmed") === "true"

  if (!workerName || !role) return { error: "Missing required fields" }

  // Prevent double clock-in
  const existing = await getOpenPunch(workerName)
  if (existing) return { error: "Already clocked in" }

  // Schedule check
  const { warning, scheduledShift: _ } = await checkSchedule(workerName, role, "in", locationId)

  // Level 2: return warning to client before committing — unless already confirmed
  if (warning && !confirmed) {
    return { scheduleWarning: warning }
  }

  const { data, error } = await supabase
    .from("staff_time_punches")
    .insert({
      location_id:    locationId,
      worker_name:    workerName,
      role,
      notes,
      schedule_flag:  warning?.flag  ?? null,
      flag_minutes:   warning?.flagMinutes ?? null,
    })
    .select()
    .single()

  if (error) return { error: "Failed to clock in" }

  // Level 3: email alert (disabled by default)
  if (warning && SCHEDULE_ALERT_EMAIL_ENABLED) {
    const nowStr = new Date().toLocaleTimeString("en-US", {
      timeZone: "America/New_York", hour: "numeric", minute: "2-digit",
    })
    await sendScheduleAlertEmail(SCHEDULE_ALERT_RECIPIENT, {
      workerName,
      role,
      flag:          warning.flag,
      flagMinutes:   warning.flagMinutes,
      clockTime:     nowStr,
      scheduledTime: warning.scheduledTime,
    })
  }

  revalidatePath("/admin/schedule")
  revalidatePath("/staff")
  return { punch: data as TimePunch }
}

export async function clockOut(formData: FormData) {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const punchId       = formData.get("punchId")      as string
  const breakMinutes  = parseInt(formData.get("breakMinutes") as string || "0", 10)
  const notes         = (formData.get("notes") as string) || null
  const confirmed     = formData.get("confirmed") === "true"

  if (!punchId) return { error: "Missing punch ID" }

  // Get the open punch to know worker + role for schedule check
  const { data: punchData } = await supabase
    .from("staff_time_punches")
    .select("worker_name, role")
    .eq("id", punchId)
    .single()

  let outFlag: ScheduleFlag | null = null
  let outFlagMinutes = 0

  if (punchData) {
    const { warning } = await checkSchedule(punchData.worker_name, punchData.role, "out", locationId)
    if (warning && !confirmed) return { scheduleWarning: warning }
    outFlag        = warning?.flag ?? null
    outFlagMinutes = warning?.flagMinutes ?? 0

    // Level 3 email for out-flags
    if (warning && SCHEDULE_ALERT_EMAIL_ENABLED) {
      const nowStr = new Date().toLocaleTimeString("en-US", {
        timeZone: "America/New_York", hour: "numeric", minute: "2-digit",
      })
      await sendScheduleAlertEmail(SCHEDULE_ALERT_RECIPIENT, {
        workerName:    punchData.worker_name,
        role:          punchData.role,
        flag:          warning.flag,
        flagMinutes:   warning.flagMinutes,
        clockTime:     nowStr,
        scheduledTime: warning.scheduledTime,
      })
    }
  }

  const { error } = await supabase
    .from("staff_time_punches")
    .update({
      clocked_out_at: new Date().toISOString(),
      break_minutes:  isNaN(breakMinutes) ? 0 : breakMinutes,
      ...(notes ? { notes } : {}),
      // Only set out-flag if no in-flag was already recorded
      ...(outFlag ? { schedule_flag: outFlag, flag_minutes: outFlagMinutes } : {}),
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
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase
    .from("staff_time_punches")
    .select("*")
    .eq("location_id", locationId)
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
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase
    .from("staff_time_punches")
    .select("*")
    .eq("location_id", locationId)
    .gte("clocked_in_at", `${dateFrom}T00:00:00`)
    .lte("clocked_in_at", `${dateTo}T23:59:59`)
    .order("clocked_in_at", { ascending: false })
  return (data ?? []) as TimePunch[]
}

// ── Scheduled shifts ──────────────────────────────────────────────────────────

export async function getShiftsForWeek(weekStart: string): Promise<ScheduledShift[]> {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  // weekStart is YYYY-MM-DD (Monday); weekEnd is 6 days later (Sunday)
  const start     = new Date(weekStart)
  const end       = new Date(weekStart)
  end.setDate(end.getDate() + 6)
  const weekEnd   = end.toISOString().split("T")[0]

  const { data } = await supabase
    .from("staff_scheduled_shifts")
    .select("*")
    .eq("location_id", locationId)
    .gte("shift_date", weekStart)
    .lte("shift_date", weekEnd)
    .order("shift_date")
    .order("start_time")
  return (data ?? []) as ScheduledShift[]
}

export async function createShift(formData: FormData) {
  await requireAdmin()

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
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
    .insert({ location_id: locationId, worker_name: workerName, role, shift_date: shiftDate, start_time: startTime, end_time: endTime, notes })
    .select()
    .single()

  if (error) return { error: "Failed to create shift" }

  revalidatePath("/admin/schedule")
  return { shift: data as ScheduledShift }
}

export async function deleteShift(shiftId: string) {
  await requireAdmin()

  const supabase = createAdminClient()
  await supabase.from("staff_scheduled_shifts").delete().eq("id", shiftId)
  revalidatePath("/admin/schedule")
}

// ── Admin: edit a punch (manual correction) ──────────────────────────────────
export async function updatePunch(formData: FormData) {
  await requireAdmin()

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

export async function createPunch(formData: FormData) {
  await requireAdmin()

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const workerName    = formData.get("workerName")    as string
  const role          = formData.get("role")          as string
  const date          = formData.get("date")          as string   // YYYY-MM-DD
  const startTime     = formData.get("startTime")     as string   // HH:MM
  const endTime       = (formData.get("endTime")      as string) || null
  const breakMinutes  = parseInt(formData.get("breakMinutes") as string || "0", 10)

  if (!workerName || !role || !date || !startTime) return { error: "Missing required fields" }

  const clockedInAt  = `${date}T${startTime}:00`
  const clockedOutAt = endTime ? `${date}T${endTime}:00` : null

  const { error } = await supabase
    .from("staff_time_punches")
    .insert({
      location_id:    locationId,
      worker_name:    workerName,
      role,
      clocked_in_at:  clockedInAt,
      clocked_out_at: clockedOutAt,
      break_minutes:  isNaN(breakMinutes) ? 0 : breakMinutes,
    })

  revalidatePath("/admin/schedule")
  if (error) return { error: error.message }
  return { success: true }
}
