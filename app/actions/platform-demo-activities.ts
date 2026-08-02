"use server"

// ── Sales funnel activity log ─────────────────────────────────────────────
// This is the missing piece that makes "stale" mean something: without a
// record of calls/emails/notes, there's no way to tell "gone quiet" from
// "actually being worked." Every entry here — manual or automatic — also
// touches platform_demo_requests.updated_at, which is exactly what the
// stale-lead badge on /super-admin/demo-requests reads from. So logging a
// call, sending a note-to-self, or the system sending an automated nudge
// email all count as "this lead was touched" and reset the staleness clock.

import { Resend } from "resend"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireSuperAdmin } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"

const resend = new Resend(process.env.RESEND_API_KEY ?? "re_missing")

export type ActivityType = "note" | "call" | "email_sent" | "status_change"

export interface DemoActivity {
  id: string
  type: ActivityType
  body: string | null
  created_at: string
}

export async function getDemoRequestActivities(requestId: string): Promise<DemoActivity[]> {
  await requireSuperAdmin()
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("demo_request_activities")
    .select("id, type, body, created_at")
    .eq("demo_request_id", requestId)
    .order("created_at", { ascending: false })
  return (data ?? []) as DemoActivity[]
}

// Internal helper — used both by the manual "Log a note/call" UI action
// below AND by every automated send (guide email, follow-up nudges, signup
// link) so the timeline shows the full picture without the admin having to
// log the system's own actions by hand. Not exported as a server action
// itself (no "use server" function signature restrictions to worry about
// since callers are all other server-side modules, not client code).
async function recordActivity(requestId: string, type: ActivityType, body?: string | null): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from("demo_request_activities").insert({ demo_request_id: requestId, type, body: body ?? null })
  await supabase.from("platform_demo_requests").update({ updated_at: new Date().toISOString() }).eq("id", requestId)
}

export async function logDemoRequestActivity(requestId: string, type: "note" | "call", body: string): Promise<{ error?: string }> {
  await requireSuperAdmin()
  const trimmed = body.trim()
  if (!trimmed) return { error: "Enter some text before logging this." }
  await recordActivity(requestId, type, trimmed)
  revalidatePath("/super-admin/demo-requests")
  return {}
}

// Records an automated system action (guide email, follow-up nudge, signup
// link) in the same timeline — called from platform-demo-site.ts,
// platform-demo-email.ts, and platform-billing.ts, not from the UI directly.
export async function logAutomatedActivity(requestId: string, type: ActivityType, body?: string | null): Promise<void> {
  await recordActivity(requestId, type, body ?? null)
}

// A one-off custom email, written and sent right from the funnel — the
// other half of "a real way to interact with them." Logged as an
// "email_sent" activity so it shows up in the same timeline as the
// automated emails, distinguishing what a human actually said.
export async function sendCustomEmailToLead(params: {
  requestId: string
  toEmail: string
  toName: string
  subject: string
  body: string
}): Promise<{ error?: string; success?: true }> {
  await requireSuperAdmin()
  const subject = params.subject.trim()
  const body = params.body.trim()
  if (!subject || !body) return { error: "Subject and message are both required." }

  const firstName = params.toName.trim().split(" ")[0] || params.toName
  const htmlBody = body.split("\n").map(line => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">${line || "&nbsp;"}</p>`).join("")

  const result = await resend.emails.send({
    from: "WashFoldClean <clean@washfoldorlando.com>",
    to: [params.toEmail],
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#333">
        <p style="font-size:15px;line-height:1.6">Hi ${firstName},</p>
        ${htmlBody}
        <p style="font-size:14px;color:#888;margin-top:24px">— The WashFoldClean Team</p>
      </div>
    `,
  })

  if (result.error) return { error: result.error.message }

  await recordActivity(params.requestId, "email_sent", `Subject: ${subject}\n\n${body}`)
  revalidatePath("/super-admin/demo-requests")
  return { success: true }
}
