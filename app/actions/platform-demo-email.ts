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
  language?: "en" | "es"
  // Included only on first send (see createDemoTenantForRequest) -- a
  // resend for an already-provisioned request has no new password to show
  // and shouldn't imply one was just reset. When present, renders directly
  // in THIS email instead of a separate one: two independent sends were two
  // independent chances for one to silently fail, which is exactly how a
  // real prospect got the demo-site email but never the admin login email.
  adminEmail?: string
  adminPassword?: string
}) {
  const lang = params.language === "es" ? "es" : "en"
  const siteUrlForAdminLogin = process.env.NEXT_PUBLIC_SITE_URL || "https://www.comforterwash.com"
  const firstName = params.name.trim().split(" ")[0] || params.name
  const demoUrl = params.demoUrl

  const T = {
    en: {
      subject: `${firstName}, here's your WashFoldClean demo \u{1F680}`,
      intro: `Thanks for requesting a demo of WashFoldClean${params.business ? ` for <strong>${params.business}</strong>` : ""} —
        we're excited to show you around. Here's everything you need to explore it yourself, right now, plus a
        PDF guide attached to this email covering the same steps in more depth.`,
      about: `A little about us: we're laundry pickup &amp; delivery operators ourselves — not a software company guessing at what
        this business needs. We built WashFoldClean to run our own operation, and unlike most tools in this space, it's
        designed first for small operators who don't own a laundromat: working out of your own home, or partnering with a
        local laundromat as your processing facility. If that's closer to how you run (or want to run) your business, this
        was built with you in mind.`,
      demoLabel: "Your Own Demo Site",
      demoBtn: "Open Your Demo →",
      guideTitle: "A quick guide to what you're looking at:",
      steps: [
        `This is a real, live mini-site set up just for you at <strong>${demoUrl}</strong> — pre-loaded with sample services and pricing so you can see exactly how it would look and work.`,
        `Browse it like a customer would: check out "Pick Up &amp; Delivery," "How It Works," "Pricing," and "FAQ" in the top menu.`,
        `Try the actual booking flow — pick dates, add-ons, and see pricing update live. Feel free to stop before entering real payment details; nothing here processes real charges yet.`,
        params.adminPassword
          ? `Your admin dashboard login is below — that's where you can change your logo, colors, pricing, and text yourself, no code needed.`
          : `Your site's admin dashboard is where you can change your logo, colors, pricing, and text yourself, no code needed.`,
        `Want the full feature list and pricing to sign up for real? Visit <a href="${PLATFORM_URL}" style="color:#E8726A">${PLATFORM_URL}</a>.`,
      ],
      whyTitle: "Why laundry businesses choose WashFoldClean:",
      why: [
        `<strong>Built for operators without a laundromat</strong> — run everything from home, or route orders to a local laundromat you partner with as your processing facility. Most platforms assume you own a facility; we don't.`,
        `<strong>A dedicated comforter service, built in</strong> — comforters get their own booking flow, pricing, and handling, not just another "item" on a wash & fold list. Most competing platforms have no idea what to do with a comforter order.`,
        `<strong>An admin dashboard that fits you</strong> — a simple mode for solo operators, a full toolset for teams running a facility, same platform either way.`,
        `<strong>Your own branded site</strong> — your name, logo, and colors, bilingual out of the box.`,
        `<strong>Billing handled for you</strong> — Stripe-powered one-time orders, subscriptions, tips, and promo codes.`,
        `<strong>Driver dispatch &amp; tracking</strong> — optional live tracking and customer texts, whether you hire drivers or deliver yourself.`,
        `<strong>PIN-protected worker apps</strong> — separate driver and operator views so your team only sees what they need.`,
        `<strong>No code, ever</strong> — promotions, testimonials, FAQs, and pricing are all editable from your own dashboard.`,
      ],
      closing: "Have questions after browsing, or want a live walkthrough instead? Just reply to this email — happy to jump on a call.",
      sign: "— The WashFoldClean Team",
      hi: `Hi ${firstName},`,
      adminLabel: "Your Admin Login",
      adminEmailLabel: "Email",
      adminPasswordLabel: "Password",
      adminLoginLink: "Sign in to your dashboard",
    },
    es: {
      subject: `${firstName}, aquí tienes tu demo de WashFoldClean \u{1F680}`,
      intro: `Gracias por solicitar una demo de WashFoldClean${params.business ? ` para <strong>${params.business}</strong>` : ""} —
        estamos emocionados de mostrártela. Aquí tienes todo lo que necesitas para explorarla tú mismo(a), ahora mismo, además de una
        guía en PDF adjunta a este correo con los mismos pasos explicados con más detalle.`,
      about: `Un poco sobre nosotros: somos operadores de recogida y entrega de lavandería nosotros mismos — no una empresa de software adivinando lo que
        este negocio necesita. Construimos WashFoldClean para manejar nuestra propia operación, y a diferencia de la mayoría de herramientas en este espacio, está
        diseñada primero para operadores pequeños que no son dueños de una lavandería: trabajando desde tu propia casa, o asociándote con
        una lavandería local como tu instalación de procesamiento. Si eso se parece más a cómo manejas (o quieres manejar) tu negocio, esto
        fue construido pensando en ti.`,
      demoLabel: "Tu Propio Sitio de Demo",
      demoBtn: "Abrir Tu Demo →",
      guideTitle: "Una guía rápida de lo que estás viendo:",
      steps: [
        `Este es un mini-sitio real y en vivo creado solo para ti en <strong>${demoUrl}</strong> — precargado con servicios y precios de muestra para que veas exactamente cómo se vería y funcionaría.`,
        `Explóralo como lo haría un cliente: revisa "Recogida y Entrega," "Cómo Funciona," "Precios," y "Preguntas Frecuentes" en el menú superior.`,
        `Prueba el flujo real de reservación — elige fechas, complementos, y mira cómo se actualiza el precio en vivo. Puedes detenerte antes de ingresar datos de pago reales; nada aquí procesa cobros reales todavía.`,
        params.adminPassword
          ? `El acceso a tu panel de administración está más abajo — ahí es donde puedes cambiar tu logo, colores, precios y textos tú mismo(a), sin necesidad de código.`
          : `El panel de administración de tu sitio es donde puedes cambiar tu logo, colores, precios y textos tú mismo(a), sin necesidad de código.`,
        `¿Quieres la lista completa de funciones y precios para registrarte de verdad? Visita <a href="${PLATFORM_URL}" style="color:#E8726A">${PLATFORM_URL}</a>.`,
      ],
      whyTitle: "Por qué los negocios de lavandería eligen WashFoldClean:",
      why: [
        `<strong>Diseñado para operadores sin lavandería propia</strong> — maneja todo desde casa, o dirige pedidos a una lavandería local con la que te asocies como tu instalación de procesamiento. La mayoría de plataformas asumen que tienes una planta; la nuestra no.`,
        `<strong>Un servicio dedicado para edredones, incluido</strong> — los edredones tienen su propio flujo de reservación, precios y manejo, no solo otro "artículo" en una lista de lavado y doblado. La mayoría de plataformas de la competencia no sabe qué hacer con un pedido de edredón.`,
        `<strong>Un panel de administración que se adapta a ti</strong> — un modo simple para operadores solos, un juego de herramientas completo para equipos que manejan una planta, la misma plataforma en ambos casos.`,
        `<strong>Tu propio sitio con tu marca</strong> — tu nombre, logo y colores, bilingüe desde el primer día.`,
        `<strong>Facturación resuelta por nosotros</strong> — pedidos únicos, suscripciones, propinas y códigos promocionales, todo con Stripe.`,
        `<strong>Despacho y rastreo de conductores</strong> — rastreo en vivo opcional y mensajes de texto a clientes, ya sea que contrates conductores o entregues tú mismo(a).`,
        `<strong>Apps para trabajadores protegidas con PIN</strong> — vistas separadas para conductores y operadores, para que tu equipo solo vea lo que necesita.`,
        `<strong>Sin código, nunca</strong> — promociones, testimonios, preguntas frecuentes y precios son editables desde tu propio panel.`,
      ],
      closing: "¿Tienes preguntas después de explorar, o prefieres un recorrido en vivo? Solo responde a este correo — con gusto agendamos una llamada.",
      sign: "— El Equipo de WashFoldClean",
      hi: `Hola ${firstName},`,
      adminLabel: "Tu Acceso de Administrador",
      adminEmailLabel: "Correo",
      adminPasswordLabel: "Contraseña",
      adminLoginLink: "Inicia sesión en tu panel",
    },
  }
  const t = T[lang]
  const subject = t.subject

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#333">
      <p style="font-size:15px;line-height:1.6">${t.hi}</p>
      <p style="font-size:15px;line-height:1.6">${t.intro}</p>
      <p style="font-size:15px;line-height:1.6">${t.about}</p>

      <div style="background:#0D2240;border-radius:16px;padding:24px;text-align:center;margin:24px 0">
        <p style="color:rgba(255,255,255,0.6);font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 10px">${t.demoLabel}</p>
        <a href="${demoUrl}" style="display:inline-block;background:#E8726A;color:white;font-weight:800;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:999px;text-transform:uppercase;letter-spacing:0.5px">
          ${t.demoBtn}
        </a>
        <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:14px 0 0">${demoUrl}</p>
      </div>

      ${params.adminPassword ? `
      <div style="background:#f7f8fb;border:1px solid #e5e7eb;border-radius:12px;padding:18px 20px;margin:0 0 24px">
        <p style="color:#0D2240;font-size:13px;font-weight:700;margin:0 0 10px">${t.adminLabel}</p>
        <p style="color:#444;font-size:13px;margin:0 0 4px"><strong>${t.adminEmailLabel}:</strong> ${params.adminEmail}</p>
        <p style="color:#444;font-size:13px;margin:0 0 12px;font-family:monospace"><strong>${t.adminPasswordLabel}:</strong> ${params.adminPassword}</p>
        <a href="${siteUrlForAdminLogin}/admin/login" style="color:#E8726A;font-size:13px;font-weight:700;text-decoration:none">${t.adminLoginLink} →</a>
      </div>
      ` : ""}

      <p style="font-size:15px;font-weight:700;color:#0D2240;margin-bottom:8px">${t.guideTitle}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
        ${t.steps.map((step, i) => {
          const borderTop = i > 0 ? "border-top:1px solid #eee;" : ""
          const bg = i % 2 === 0 ? "background:#f8f8f8;" : ""
          return `
        <tr>
          <td style="padding:10px 12px;${borderTop}${bg}font-weight:700;color:#0D2240;width:28px;vertical-align:top">${i + 1}</td>
          <td style="padding:10px 12px;${borderTop}${bg}">${step}</td>
        </tr>`
        }).join("")}
      </table>

      <p style="font-size:15px;font-weight:700;color:#0D2240;margin-bottom:8px">${t.whyTitle}</p>
      <ul style="font-size:14px;line-height:1.9;color:#555;padding-left:20px;margin-top:0">
        ${t.why.map(w => `<li>${w}</li>`).join("")}
      </ul>

      <p style="font-size:15px;line-height:1.6;margin-top:20px">${t.closing}</p>
      <p style="font-size:14px;color:#888;margin-top:24px">${t.sign}</p>
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

function followUpSubject(step: number, firstName: string, lang: "en" | "es"): string {
  if (lang === "es") {
    if (step === 1) return `${firstName}, ¿sigues explorando tu demo de WashFoldClean?`
    if (step === 2) return `Un par de cosas que se me olvidó mencionar, ${firstName}`
    return `Último aviso, ${firstName} — cerrando el tema`
  }
  if (step === 1) return `${firstName}, still exploring your WashFoldClean demo?`
  if (step === 2) return `A couple things I forgot to mention, ${firstName}`
  return `Last check-in, ${firstName} — closing the loop`
}

function followUpHtml(step: number, params: { firstName: string; demoUrl: string; business?: string | null; lang: "en" | "es" }): string {
  const { firstName, demoUrl, business, lang } = params
  const bizPart = business ? (lang === "es" ? ` de ${business}` : ` for ${business}`) : ""

  const body = lang === "es"
    ? (step === 1
        ? `Quería asegurarme de que tu demo${bizPart} no se perdiera — sigue en vivo y esperándote en el enlace de abajo. Tómate unos minutos para explorar el flujo de reservación y las preguntas frecuentes cuando puedas.`
        : step === 2
        ? `Un seguimiento rápido — un par de cosas que los interesados suelen preguntar y que no cubrí la primera vez: el flujo de reservación específico para edredones (la mayoría de plataformas no lo tiene), y el "modo simple" del panel de administración, hecho para operadores solos que no quieren una docena de pantallas de configuración. Ambos ya están activos en tu demo.`
        : `No he sabido de ti, así que seré breve — si ahora no es el momento adecuado, no hay problema, solo responde y avísame. Si sigues interesado(a), tu sitio de demo sigue activo y con gusto agendamos una llamada rápida cuando te convenga.`)
    : (step === 1
        ? `Wanted to make sure your demo${bizPart} didn't get buried — it's still live and waiting for you at the link below. Take a few minutes to click around the booking flow and FAQ when you get a chance.`
        : step === 2
        ? `Quick follow-up — a couple things prospects usually ask about that I didn't cover the first time: the comforter-specific booking flow (most platforms don't have one), and the admin dashboard's "Simple mode," built for solo operators who don't want a dozen settings screens. Both are already live in your demo.`
        : `Haven't heard back, so I'll keep this brief — if now's not the right time, no worries at all, just reply and let me know. If you're still interested, your demo site is still live and I'm happy to jump on a quick call whenever works.`)

  const hi = lang === "es" ? `Hola ${firstName},` : `Hi ${firstName},`
  const btn = lang === "es" ? "Abrir Tu Demo →" : "Open Your Demo →"
  const sign = lang === "es" ? "— El Equipo de WashFoldClean" : "— The WashFoldClean Team"

  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#333">
      <p style="font-size:15px;line-height:1.6">${hi}</p>
      <p style="font-size:15px;line-height:1.6">${body}</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${demoUrl}" style="display:inline-block;background:#E8726A;color:white;font-weight:800;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:999px;text-transform:uppercase;letter-spacing:0.5px">
          ${btn}
        </a>
      </div>
      <p style="font-size:14px;color:#888;margin-top:24px">${sign}</p>
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
    .select("id, name, email, business, status, demo_email_sent_at, follow_up_count, last_follow_up_sent_at, preferred_language, locations(slug)")
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

      const followLang: "en" | "es" = lead.preferred_language === "es" ? "es" : "en"
      const result = await resend.emails.send({
        from: `WashFoldClean <${SEND_ADDRESS}>`,
        to: [lead.email],
        subject: followUpSubject(step, firstName, followLang),
        html: followUpHtml(step, { firstName, demoUrl, business: lead.business, lang: followLang }),
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
