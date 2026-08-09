"use server"

import { Resend } from "resend"
import { requireSuperAdmin } from "@/lib/auth-guard"
import { createAdminClient } from "@/lib/supabase/admin"

const resend = new Resend(process.env.RESEND_API_KEY ?? "re_missing")
const SEND_ADDRESS = "clean@washfoldorlando.com"
const PLATFORM_URL = "https://www.comforterwash.com/platform"

// Sent to anyone who requests a demo via the /platform "Request a Demo" form —
// either automatically right after they submit (see requestPlatformDemo in
// platform-contact.ts) or manually re-sent from /super-admin/demo-requests.
// Distinct from the tenant-branded emails in lib/email.ts: this one always
// speaks as the platform itself (WashFoldClean), never a tenant's brand.
export async function sendPlatformDemoGuideEmail(params: {
  name: string
  email: string
  business?: string | null
  demoUrl: string
}) {
  const firstName = params.name.trim().split(" ")[0] || params.name
  const subject = `${firstName}, here's your WashFoldClean demo 🚀`
  const demoUrl = params.demoUrl

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#333">
      <p style="font-size:15px;line-height:1.6">Hi ${firstName},</p>
      <p style="font-size:15px;line-height:1.6">
        Thanks for requesting a demo of WashFoldClean${params.business ? ` for <strong>${params.business}</strong>` : ""} —
        we're excited to show you around. Here's everything you need to explore it yourself, right now, plus a
        PDF guide attached to this email covering the same steps in more depth.
      </p>
      <p style="font-size:15px;line-height:1.6">
        A little about us: we're laundry pickup &amp; delivery operators ourselves — not a software company guessing at what
        this business needs. We built WashFoldClean to run our own operation, and unlike most tools in this space, it's
        designed first for small operators who don't own a laundromat: working out of your own home, or partnering with a
        local laundromat as your processing facility. If that's closer to how you run (or want to run) your business, this
        was built with you in mind.
      </p>

      <div style="background:#0D2240;border-radius:16px;padding:24px;text-align:center;margin:24px 0">
        <p style="color:rgba(255,255,255,0.6);font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 10px">Your Own Demo Site</p>
        <a href="${demoUrl}" style="display:inline-block;background:#E8726A;color:white;font-weight:800;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:999px;text-transform:uppercase;letter-spacing:0.5px">
          Open Your Demo →
        </a>
        <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:14px 0 0">${demoUrl}</p>
      </div>

      <p style="font-size:15px;font-weight:700;color:#0D2240;margin-bottom:8px">A quick guide to what you're looking at:</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
        <tr>
          <td style="padding:10px 12px;background:#f8f8f8;font-weight:700;color:#0D2240;width:28px;vertical-align:top">1</td>
          <td style="padding:10px 12px;background:#f8f8f8">This is a real, live mini-site set up just for you at <strong>${demoUrl}</strong> — pre-loaded with sample services and pricing so you can see exactly how it would look and work.</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border-top:1px solid #eee;font-weight:700;color:#0D2240;vertical-align:top">2</td>
          <td style="padding:10px 12px;border-top:1px solid #eee">Browse it like a customer would: check out "Pick Up &amp; Delivery," "How It Works," "Pricing," and "FAQ" in the top menu.</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border-top:1px solid #eee;background:#f8f8f8;font-weight:700;color:#0D2240;vertical-align:top">3</td>
          <td style="padding:10px 12px;border-top:1px solid #eee;background:#f8f8f8">Try the actual booking flow — pick dates, add-ons, and see pricing update live. Feel free to stop before entering real payment details; nothing here processes real charges yet.</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border-top:1px solid #eee;font-weight:700;color:#0D2240;vertical-align:top">4</td>
          <td style="padding:10px 12px;border-top:1px solid #eee">Look out for a second email with a link straight into your site's admin dashboard — that's where you can change your logo, colors, pricing, and text yourself, no code needed.</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border-top:1px solid #eee;background:#f8f8f8;font-weight:700;color:#0D2240;vertical-align:top">5</td>
          <td style="padding:10px 12px;border-top:1px solid #eee;background:#f8f8f8">
            Want the full feature list and pricing to sign up for real? Visit <a href="${PLATFORM_URL}" style="color:#E8726A">${PLATFORM_URL}</a>.
          </td>
        </tr>
      </table>

      <p style="font-size:15px;font-weight:700;color:#0D2240;margin-bottom:8px">Why laundry businesses choose WashFoldClean:</p>
      <ul style="font-size:14px;line-height:1.9;color:#555;padding-left:20px;margin-top:0">
        <li><strong>Built for operators without a laundromat</strong> — run everything from home, or route orders to a local laundromat you partner with as your processing facility. Most platforms assume you own a facility; we don't.</li>
        <li><strong>A dedicated comforter service, built in</strong> — comforters get their own booking flow, pricing, and handling, not just another "item" on a wash & fold list. Most competing platforms have no idea what to do with a comforter order.</li>
        <li><strong>An admin dashboard that fits you</strong> — a simple mode for solo operators, a full toolset for teams running a facility, same platform either way.</li>
        <li><strong>Your own branded site</strong> — your name, logo, and colors, bilingual out of the box.</li>
        <li><strong>Billing handled for you</strong> — Stripe-powered one-time orders, subscriptions, tips, and promo codes.</li>
        <li><strong>Driver dispatch &amp; tracking</strong> — optional live tracking and customer texts, whether you hire drivers or deliver yourself.</li>
        <li><strong>PIN-protected worker apps</strong> — separate driver and operator views so your team only sees what they need.</li>
        <li><strong>No code, ever</strong> — promotions, testimonials, FAQs, and pricing are all editable from your own dashboard.</li>
      </ul>

      <p style="font-size:15px;line-height:1.6;margin-top:20px">
        Have questions after browsing, or want a live walkthrough instead? Just reply to this email — happy to jump on a call.
      </p>
      <p style="font-size:14px;color:#888;margin-top:24px">— The WashFoldClean Team</p>
    </div>
  `

  // Attach the standalone PDF guide (public/demo-guide.pdf) — same content as
  // the email itself, but something they can save, print, or forward to a
  // partner without digging back through their inbox.
  //
  // Fetched over HTTP rather than read off disk — a serverless function's
  // filesystem (process.cwd()) doesn't reliably include everything under
  // public/ at runtime, which is exactly what was happening here (confirmed
  // via prod logs: ENOENT on every send). public/ files ARE always served
  // over HTTP by Vercel's CDN, so fetching the live URL is the reliable path.
  let attachments: { filename: string; content: Buffer }[] | undefined
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.comforterwash.com"
    const res = await fetch(`${siteUrl}/demo-guide.pdf`)
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
    const pdfBuffer = Buffer.from(await res.arrayBuffer())
    attachments = [{ filename: "WashFoldClean-Demo-Guide.pdf", content: pdfBuffer }]
  } catch (err) {
    console.error("[platform-demo-email] Could not attach PDF guide:", err)
  }

  const result = await resend.emails.send({
    from: `WashFoldClean <${SEND_ADDRESS}>`,
    to: [params.email],
    subject,
    html,
    ...(attachments ? { attachments } : {}),
  })

  if (result.error) {
    console.error("[platform-demo-email] Resend error:", result.error)
    return { error: result.error.message }
  }
  return { success: true }
}

// Auto-called right after a demo request is recorded (see requestPlatformDemo).
// Provisions a real tenant site for this prospect (or reuses one already
// created for this request) and emails them the guide. Never throws — a
// failure here shouldn't block the request itself.
export async function autoSendDemoGuideEmail(requestId: string) {
  try {
    const { createDemoTenantForRequest } = await import("@/app/actions/platform-demo-site")
    await createDemoTenantForRequest(requestId)
  } catch (err) {
    console.error("[platform-demo-email] autoSendDemoGuideEmail failed:", err)
  }
}

// Manual (re)trigger from /super-admin/demo-requests — e.g. for requests
// submitted before this feature existed, auto-creation that failed, or to
// resend the same tenant's demo email again.
export async function resendDemoGuideEmail(requestId: string) {
  await requireSuperAdmin()
  const { createDemoTenantForRequest } = await import("@/app/actions/platform-demo-site")
  return createDemoTenantForRequest(requestId)
}

// ── One-off "new guide" announcement ──────────────────────────────────────
// Sent manually (not on a schedule) to prospects already in the funnel, to
// point them at the expanded platform guide — the public /guide page (no
// login required) plus the same content as a PDF attachment they can keep.
// Reuses the same public/guide.pdf → HTTP-fetch → attach approach as the
// initial demo-guide email, for the same reason (serverless filesystem
// access to public/ is unreliable; the CDN URL always works).
function guideAnnouncementHtml(firstName: string, guideUrl: string): string {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#333">
      <p style="font-size:15px;line-height:1.6">Hi ${firstName},</p>
      <p style="font-size:15px;line-height:1.6">
        Quick update — we just put together a much more detailed guide to how WashFoldClean actually works day to
        day: the admin dashboard (both the simple view and the full toolset), the driver and operator apps your team
        would use out in the field, and the customer booking site. It walks through the real screens step by step,
        not just a feature list.
      </p>
      <div style="text-align:center;margin:24px 0">
        <a href="${guideUrl}" style="display:inline-block;background:#E8726A;color:white;font-weight:800;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:999px;text-transform:uppercase;letter-spacing:0.5px">
          Read the Guide →
        </a>
        <p style="color:#999;font-size:12px;margin:14px 0 0">${guideUrl}</p>
      </div>
      <p style="font-size:15px;line-height:1.6">
        I've also attached a PDF copy to this email, in case it's easier to skim on your phone or forward to a
        business partner.
      </p>
      <p style="font-size:15px;line-height:1.6;margin-top:20px">
        Any questions after reading through it — just reply here.
      </p>
      <p style="font-size:14px;color:#888;margin-top:24px">— The WashFoldClean Team</p>
    </div>
  `
}

export async function sendGuideAnnouncementEmail(params: { name: string; email: string }) {
  const firstName = params.name.trim().split(" ")[0] || params.name
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.comforterwash.com"
  const guideUrl = `${siteUrl}/guide`

  let attachments: { filename: string; content: Buffer }[] | undefined
  try {
    const res = await fetch(`${siteUrl}/guide.pdf`)
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
    const pdfBuffer = Buffer.from(await res.arrayBuffer())
    attachments = [{ filename: "WashFoldClean-Platform-Guide.pdf", content: pdfBuffer }]
  } catch (err) {
    console.error("[platform-demo-email] Could not attach guide PDF:", err)
  }

  const result = await resend.emails.send({
    from: `WashFoldClean <${SEND_ADDRESS}>`,
    to: [params.email],
    replyTo: SEND_ADDRESS,
    subject: `${firstName}, here's a deeper look at how WashFoldClean works`,
    html: guideAnnouncementHtml(firstName, guideUrl),
    ...(attachments ? { attachments } : {}),
  })

  if (result.error) return { error: result.error.message }
  return { success: true }
}

// Sends the guide announcement to every lead still active in the funnel
// (same stage filter as the automated follow-ups — won/lost leads are done,
// a fresh guide doesn't apply). Called manually from /super-admin/demo-requests.
// Never throws per-lead; returns a summary so the UI can show what happened.
export async function sendGuideAnnouncementToAllLeads(): Promise<{ checked: number; sent: number; errors: string[] }> {
  await requireSuperAdmin()
  const supabase = createAdminClient()
  const errors: string[] = []
  let sent = 0

  const { data: leads } = await supabase
    .from("platform_demo_requests")
    .select("id, name, email, status")
    .in("status", ["new", "contacted", "demo_viewed", "negotiating"])

  for (const lead of leads ?? []) {
    try {
      const result = await sendGuideAnnouncementEmail({ name: lead.name, email: lead.email })
      if (result.error) { errors.push(`${lead.email}: ${result.error}`); continue }
      const { logAutomatedActivity } = await import("@/app/actions/platform-demo-activities")
      await logAutomatedActivity(lead.id, "email_sent", "Guide announcement email sent")
      sent++
    } catch (err) {
      errors.push(`${lead.email}: ${err instanceof Error ? err.message : "unknown error"}`)
    }
  }

  return { checked: leads?.length ?? 0, sent, errors }
}

// ── Automated follow-up sequence ──────────────────────────────────────────
// Runs daily off a cron job (see app/api/cron/demo-follow-ups/route.ts), not
// from the UI. A lead that's gone quiet after the initial demo email gets up
// to 3 nudges — day 3, day 7 (4 days after nudge 1), day 14 (7 days after
// nudge 2) — then the sequence stops. Only applies to leads still in
// "new"/"contacted"/"demo_viewed"/"negotiating" — those are exactly the
// stages a nudge is meant to help move along. Anything "won" or "lost" is
// excluded entirely.
const FOLLOW_UP_STEPS = [
  { afterDays: 3, minGapDays: 3 },  // step 1: 3 days after the initial guide email
  { afterDays: 4, minGapDays: 4 },  // step 2: 4 days after step 1 (day 7 overall)
  { afterDays: 7, minGapDays: 7 },  // step 3: 7 days after step 2 (day 14 overall)
] as const

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)
}

function followUpSubject(step: number, firstName: string): string {
  if (step === 1) return `${firstName}, still exploring your WashFoldClean demo?`
  if (step === 2) return `A couple things I forgot to mention, ${firstName}`
  return `Last check-in, ${firstName} — closing the loop`
}

function followUpHtml(step: number, params: { firstName: string; demoUrl: string; business?: string | null }): string {
  const { firstName, demoUrl, business } = params
  const bizPart = business ? ` for ${business}` : ""
  const body =
    step === 1
      ? `Wanted to make sure your demo${bizPart} didn't get buried — it's still live and waiting for you at the link below. Take a few minutes to click around the booking flow and FAQ when you get a chance.`
      : step === 2
      ? `Quick follow-up — a couple things prospects usually ask about that I didn't cover the first time: the comforter-specific booking flow (most platforms don't have one), and the admin dashboard's "Simple mode," built for solo operators who don't want a dozen settings screens. Both are already live in your demo.`
      : `Haven't heard back, so I'll keep this brief — if now's not the right time, no worries at all, just reply and let me know. If you're still interested, your demo site is still live and I'm happy to jump on a quick call whenever works.`

  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#333">
      <p style="font-size:15px;line-height:1.6">Hi ${firstName},</p>
      <p style="font-size:15px;line-height:1.6">${body}</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${demoUrl}" style="display:inline-block;background:#E8726A;color:white;font-weight:800;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:999px;text-transform:uppercase;letter-spacing:0.5px">
          Open Your Demo →
        </a>
      </div>
      <p style="font-size:14px;color:#888;margin-top:24px">— The WashFoldClean Team</p>
    </div>
  `
}

// Called by the daily cron route. Returns a summary for logging — never
// throws per-lead (one bad send shouldn't block the rest of the batch).
export async function runDemoFollowUpSequence(): Promise<{ checked: number; sent: number; errors: string[] }> {
  const supabase = createAdminClient()
  const errors: string[] = []
  let sent = 0

  const { data: leads } = await supabase
    .from("platform_demo_requests")
    .select("id, name, email, business, status, demo_email_sent_at, follow_up_count, last_follow_up_sent_at, locations(slug)")
    .in("status", ["new", "contacted", "demo_viewed", "negotiating"])
    .not("demo_email_sent_at", "is", null)
    .lt("follow_up_count", FOLLOW_UP_STEPS.length)

  const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "washfoldclean.com"

  for (const lead of leads ?? []) {
    try {
      const step = lead.follow_up_count + 1 // 1-indexed
      const stepConfig = FOLLOW_UP_STEPS[lead.follow_up_count]
      const lastTouch = lead.last_follow_up_sent_at ?? lead.demo_email_sent_at
      if (!lastTouch) continue

      const elapsed = daysSince(lastTouch)
      const threshold = lead.follow_up_count === 0 ? stepConfig.afterDays : stepConfig.minGapDays
      if (elapsed < threshold) continue

      const slug = (lead.locations as { slug?: string } | null)?.slug
      if (!slug) continue // no demo site provisioned — nothing to point them back to
      const demoUrl = `https://${slug}.${platformDomain}`
      const firstName = lead.name.trim().split(" ")[0] || lead.name

      const result = await resend.emails.send({
        from: `WashFoldClean <${SEND_ADDRESS}>`,
        to: [lead.email],
        subject: followUpSubject(step, firstName),
        html: followUpHtml(step, { firstName, demoUrl, business: lead.business }),
      })

      if (result.error) {
        errors.push(`${lead.email}: ${result.error.message}`)
        continue
      }

      await supabase
        .from("platform_demo_requests")
        .update({ follow_up_count: step, last_follow_up_sent_at: new Date().toISOString() })
        .eq("id", lead.id)
      const { logAutomatedActivity } = await import("@/app/actions/platform-demo-activities")
      await logAutomatedActivity(lead.id, "email_sent", `Automated follow-up #${step} sent`)
      sent++
    } catch (err) {
      errors.push(`${lead.email}: ${err instanceof Error ? err.message : "unknown error"}`)
    }
  }

  return { checked: leads?.length ?? 0, sent, errors }
}
