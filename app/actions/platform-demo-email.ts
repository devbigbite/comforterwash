"use server"

import { Resend } from "resend"
import { requireSuperAdmin } from "@/lib/auth-guard"
import { createAdminClient } from "@/lib/supabase/admin"

const resend = new Resend(process.env.RESEND_API_KEY ?? "re_missing")
const SEND_ADDRESS = "clean@washfoldorlando.com"
const PLATFORM_URL = "https://www.washfoldkit.com"

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
      subject: `${firstName}, here's your WashFoldKit demo \u{1F680}`,
      hi: `Hi ${firstName},`,
      intro: `Thanks for taking a look at WashFoldKit${params.business ? ` for <strong>${params.business}</strong>` : ""} — I wanted to
        reach out myself and welcome you into our family. Our system has been developed by me and a small crew, not
        just a software company that's never done wash and fold. Your demo site and admin login below stay active
        for the next <strong>7 days</strong> — so you can look around before deciding.`,
      founderName: "JB",
      founderTitle: "Founder, WashFoldKit",
      founderPhotoUrl: `${siteUrlForAdminLogin}/founder-jb.jpg`,
      founderNote1: `A little about why I built this: I run a real wash &amp; fold pickup-delivery business myself.
        Every price sheet, every driver route, every question — I've lived it first. WashFoldKit isn't a
        guess at what operators need; it's the exact system I run on,
        opened up so you can run on it too.`,
      founderNote2: `That's the difference I want you to feel from this email on: you're not signing up for
        software support. You're getting a partner who's already made the mistakes so you don't have to. And
        getting started is probably easier than you think — if you already have a car, a washer, and a dryer
        at home, you're 95% of the way there. Your biggest investment is already made.`,
      pillarsIntro: `Here's what I mean by that in practice — the support built into WashFoldKit, beyond the booking site itself:`,
      pillars: [
        {
          icon: "\u{1F4D6}",
          title: "The Playbook — you're never starting from a blank page",
          desc: "Order-processing guides and manuals. Real processes — the same ones my own team uses.",
        },
        {
          icon: "\u{1F9F0}",
          title: "The Launch Kit — nothing to design or source yourself",
          desc: "Vetted suppliers for detergent, bags and tags; print-ready flyers, door hangers and social templates. You open, not build.",
        },
        {
          icon: "\u{1F64B}",
          title: "Real support, from someone who's been on the road",
          desc: "When you reply with a question, you're not filed into a ticket queue. From your first customer to your first commercial account, I'm actively here to help you find opportunities and grow — not just answer tickets.",
        },
        {
          icon: "\u{1F4B3}",
          title: "One price, everything included",
          desc: `No tiers, no &quot;upgrade to unlock.&quot; The Platform, the Playbook, and the Launch Kit all come together — because a business needs all three to actually work, not just the software.`,
        },
      ],
      demoLabel: "Your Demo Is Ready",
      demoBtn: "Open Your Demo →",
      closing: `Take your time looking around — your demo site and admin login stay live for 7 days. And if
        you'd rather just talk it through, reply to this email or reach me on WhatsApp at
        <strong>407-734-0888</strong>. It comes straight to me.`,
      sign: "— JB",
      signSub: "Founder, WashFoldKit",
      adminLabel: "Your Admin Login",
      adminEmailLabel: "Email",
      adminPasswordLabel: "Password",
      adminLoginLink: "Sign in to your dashboard",
    },
    es: {
      subject: `${firstName}, aquí tienes tu demo de WashFoldKit \u{1F680}`,
      hi: `Hola ${firstName},`,
      intro: `Gracias por evaluar WashFoldKit${params.business ? ` para <strong>${params.business}</strong>` : ""} — quise
        escribirte yo mismo y darte la bienvenida a nuestra familia. Nuestro sistema fue desarrollado por mí y un
        pequeño equipo, no solo por una empresa de software que nunca ha hecho lavado y doblado. Tu sitio de demo y
        tu acceso de administrador siguen activos durante los próximos <strong>7 días</strong> — tiempo para
        explorar antes de decidir.`,
      founderName: "JB",
      founderTitle: "Fundador, WashFoldKit",
      founderPhotoUrl: `${siteUrlForAdminLogin}/founder-jb.jpg`,
      founderNote1: `Un poco sobre por qué construí esto: yo mismo dirijo un negocio real de recogida y entrega de
        lavado y doblado. Cada tarifa, cada ruta de conductor, cada pregunta — ya la he vivido. WashFoldKit no es
        una suposición de lo que necesitan los operadores; es el mismo sistema que yo uso, abierto para que tú
        también lo uses.`,
      founderNote2: `Esa es la diferencia que quiero que sientas desde este mensaje en adelante: no te estás
        suscribiendo a soporte de software. Estás en comunicación directa con alguien que ya cometió los errores
        para que tú no tengas que hacerlo. Y empezar probablemente sea más fácil de lo que piensas — si ya tienes
        un carro, una lavadora y una secadora en casa, ya llevas el 95% del camino. Tu mayor inversión ya está hecha.`,
      pillarsIntro: `Esto es lo que quiero decir en la práctica — el soporte integrado en WashFoldKit, más allá del sitio de reservas:`,
      pillars: [
        {
          icon: "\u{1F4D6}",
          title: "El Playbook — nunca empiezas desde cero",
          desc: "Guías y manuales de procesamiento de pedidos. Procesos reales — los mismos que usa mi propio equipo.",
        },
        {
          icon: "\u{1F9F0}",
          title: "El Launch Kit — nada que diseñar o buscar por tu cuenta",
          desc: "Proveedores confiables de detergente, bolsas y etiquetas; volantes, colgadores de puerta y plantillas para redes sociales listos para imprimir. Tú abres, no construyes.",
        },
        {
          icon: "\u{1F64B}",
          title: "Soporte real, de alguien que ha estado en la carretera",
          desc: "Cuando respondes con una pregunta, no te archivan en una fila de tickets. Desde tu primer cliente hasta tu primera cuenta comercial, estoy activamente aquí para ayudarte a encontrar oportunidades y crecer — no solo a responder tickets.",
        },
        {
          icon: "\u{1F4B3}",
          title: "Un solo precio, todo incluido",
          desc: `Sin niveles, sin &quot;actualiza para desbloquear.&quot; La Plataforma, el Playbook y el Launch Kit vienen juntos — porque un negocio necesita los tres para funcionar de verdad, no solo el software.`,
        },
      ],
      demoLabel: "Tu Demo Está Lista",
      demoBtn: "Abrir Tu Demo →",
      closing: `Tómate tu tiempo para explorar — tu sitio de demo y tu acceso de administrador siguen activos por
        7 días. Y si prefieres hablarlo directamente, responde a este correo o escríbeme por WhatsApp al
        <strong>407-734-0888</strong>. Me llega directo a mí.`,
      sign: "— JB",
      signSub: "Fundador, WashFoldKit",
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

      <div style="background:#ffffff;border:1px solid #e8e6e1;border-radius:16px;padding:22px 22px 20px;margin:22px 0">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="width:76px;vertical-align:top">
              <img src="${t.founderPhotoUrl}" width="64" height="64" style="width:64px;height:64px;border-radius:50%;object-fit:cover;display:block" alt="${t.founderName}">
            </td>
            <td style="vertical-align:top;padding-left:14px">
              <p style="margin:0 0 2px;font-weight:700;color:#0D2240;font-size:14px">${t.founderName}</p>
              <p style="margin:0;font-size:12px;color:#888">${t.founderTitle}</p>
            </td>
          </tr>
        </table>
        <p style="font-size:14px;line-height:1.7;color:#444;margin:16px 0 0">${t.founderNote1}</p>
        <p style="font-size:14px;line-height:1.7;color:#444;margin:12px 0 0">${t.founderNote2}</p>
      </div>

      <p style="font-size:15px;line-height:1.6">${t.pillarsIntro}</p>

      <div style="margin:20px 0">
        ${t.pillars.map((p, i) => `
        <div style="display:table;width:100%;margin-bottom:${i === t.pillars.length - 1 ? "0" : "16px"}">
          <div style="display:table-cell;width:34px;vertical-align:top;font-size:20px">${p.icon}</div>
          <div style="display:table-cell;vertical-align:top;padding-left:8px">
            <p style="margin:0 0 4px;font-weight:700;color:#0D2240;font-size:14px">${p.title}</p>
            <p style="margin:0;font-size:13px;line-height:1.65;color:#555">${p.desc}</p>
          </div>
        </div>`).join("")}
      </div>

      <div style="background:#0D2240;border-radius:16px;padding:22px;text-align:center;margin:24px 0">
        <p style="color:rgba(255,255,255,0.65);font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 10px">${t.demoLabel}</p>
        <a href="${demoUrl}" style="display:inline-block;background:#E8726A;color:#ffffff;font-weight:800;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:999px;text-transform:uppercase;letter-spacing:0.5px">
          ${t.demoBtn}
        </a>
        <p style="color:rgba(255,255,255,0.45);font-size:12px;margin:14px 0 0">${demoUrl}</p>
      </div>

      ${params.adminPassword ? `
      <div style="background:#f7f8fb;border:1px solid #e5e7eb;border-radius:12px;padding:18px 20px;margin:0 0 24px">
        <p style="color:#0D2240;font-size:13px;font-weight:700;margin:0 0 10px">${t.adminLabel}</p>
        <p style="color:#444;font-size:13px;margin:0 0 4px"><strong>${t.adminEmailLabel}:</strong> ${params.adminEmail}</p>
        <p style="color:#444;font-size:13px;margin:0 0 12px;font-family:monospace"><strong>${t.adminPasswordLabel}:</strong> ${params.adminPassword}</p>
        <a href="${siteUrlForAdminLogin}/admin/login" style="color:#E8726A;font-size:13px;font-weight:700;text-decoration:none">${t.adminLoginLink} →</a>
      </div>
      ` : ""}

      <p style="font-size:15px;line-height:1.6">${t.closing}</p>
      <p style="font-size:14px;color:#888;margin-top:24px">${t.sign}<br><span style="font-size:12px;color:#aaa">${t.signSub}</span></p>
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
function guideAnnouncementHtml(firstName: string, guideUrl: string, lang: "en" | "es"): string {
  if (lang === "es") {
    return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#333">
      <p style="font-size:15px;line-height:1.6">Hola ${firstName},</p>
      <p style="font-size:15px;line-height:1.6">
        Actualización rápida — acabo de armar una guía mucho más detallada de cómo funciona WashFoldKit día a
        día: el panel de administración (tanto la vista simple como el juego de herramientas completo), las apps
        de conductor y operador que tu equipo usaría en el campo, y el sitio de reservas para clientes. Va paso a
        paso por las pantallas reales, no solo una lista de funciones.
      </p>
      <div style="text-align:center;margin:24px 0">
        <a href="${guideUrl}" style="display:inline-block;background:#E8726A;color:white;font-weight:800;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:999px;text-transform:uppercase;letter-spacing:0.5px">
          Leer la Guía →
        </a>
        <p style="color:#999;font-size:12px;margin:14px 0 0">${guideUrl}</p>
      </div>
      <p style="font-size:15px;line-height:1.6">
        También adjunté una copia en PDF a este correo, por si es más fácil de revisar desde tu teléfono o
        reenviarla a un socio de negocio.
      </p>
      <p style="font-size:15px;line-height:1.6;margin-top:20px">
        ¿Preguntas después de leerla? Solo responde aquí, o escríbeme por WhatsApp al 407-734-0888.
      </p>
      <p style="font-size:14px;color:#888;margin-top:24px">— JB<br><span style="font-size:12px;color:#aaa">Fundador, WashFoldKit</span></p>
    </div>
  `
  }
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#333">
      <p style="font-size:15px;line-height:1.6">Hi ${firstName},</p>
      <p style="font-size:15px;line-height:1.6">
        Quick update — I just put together a much more detailed guide to how WashFoldKit actually works day to
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
        Any questions after reading through it — just reply here, or reach me on WhatsApp at 407-734-0888.
      </p>
      <p style="font-size:14px;color:#888;margin-top:24px">— JB<br><span style="font-size:12px;color:#aaa">Founder, WashFoldKit</span></p>
    </div>
  `
}

export async function sendGuideAnnouncementEmail(params: { name: string; email: string; language?: "en" | "es" }) {
  const lang: "en" | "es" = params.language === "es" ? "es" : "en"
  const firstName = params.name.trim().split(" ")[0] || params.name
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.comforterwash.com"
  const guideUrl = `${siteUrl}/guide`

  let attachments: { filename: string; content: Buffer }[] | undefined
  try {
    const res = await fetch(`${siteUrl}/guide.pdf`)
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
    const pdfBuffer = Buffer.from(await res.arrayBuffer())
    attachments = [{ filename: "WashFoldKit-Platform-Guide.pdf", content: pdfBuffer }]
  } catch (err) {
    console.error("[platform-demo-email] Could not attach guide PDF:", err)
  }

  const subject = lang === "es"
    ? `${firstName}, aquí tienes una mirada más profunda a cómo funciona WashFoldKit`
    : `${firstName}, here's a deeper look at how WashFoldKit works`

  const result = await resend.emails.send({
    from: `WashFoldKit <${SEND_ADDRESS}>`,
    to: [params.email],
    replyTo: SEND_ADDRESS,
    subject,
    html: guideAnnouncementHtml(firstName, guideUrl, lang),
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
    .select("id, name, email, status, preferred_language")
    .in("status", ["new", "contacted", "demo_viewed", "negotiating"])

  for (const lead of leads ?? []) {
    try {
      const result = await sendGuideAnnouncementEmail({ name: lead.name, email: lead.email, language: lead.preferred_language === "es" ? "es" : "en" })
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

// One-off bulk resend — the personalized demo-guide email (founder note,
// support pillars, WhatsApp) to every lead still active in the funnel
// (won/lost excluded, same filter as sendGuideAnnouncementToAllLeads).
// Reuses resendDemoGuideEmail per lead so language and demo-site lookup
// stay identical to a single manual "Resend guide" click -- this is just
// that same action, looped.
export async function sendDemoGuideToAllActiveLeads(): Promise<{ checked: number; sent: number; errors: string[] }> {
  await requireSuperAdmin()
  const supabase = createAdminClient()
  const errors: string[] = []
  let sent = 0

  const { data: leads } = await supabase
    .from("platform_demo_requests")
    .select("id, email")
    .in("status", ["new", "contacted", "demo_viewed", "negotiating"])

  for (const lead of leads ?? []) {
    try {
      const result = await resendDemoGuideEmail(lead.id)
      if ("error" in result) { errors.push(`${lead.email}: ${result.error}`); continue }
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
    if (step === 1) return `${firstName}, ¿sigues explorando tu demo de WashFoldKit?`
    if (step === 2) return `Un par de cosas que se me olvidó mencionar, ${firstName}`
    return `¿Necesitas ayuda, ${firstName}? Estoy aquí`
  }
  if (step === 1) return `${firstName}, still exploring your WashFoldKit demo?`
  if (step === 2) return `A couple things I forgot to mention, ${firstName}`
  return `Need a hand, ${firstName}? I'm here`
}

function followUpHtml(step: number, params: { firstName: string; demoUrl: string; business?: string | null; lang: "en" | "es" }): string {
  const { firstName, demoUrl, business, lang } = params
  const bizPart = business ? (lang === "es" ? ` de ${business}` : ` for ${business}`) : ""

  const body = lang === "es"
    ? (step === 1
        ? `Quería asegurarme de que tu demo${bizPart} esté en tus manos — sigue en vivo y esperándote en el enlace de abajo. Tómate unos minutos para explorar el flujo de reservación y las preguntas frecuentes cuando puedas.`
        : step === 2
        ? `Un seguimiento rápido — un par de cosas que los interesados suelen preguntar y que no cubrí la primera vez: el flujo de reservación específico para edredones (la mayoría de plataformas no lo tiene), y el "modo simple" del panel de administración, hecho para operadores solos que no quieren una docena de pantallas de configuración. Ambos ya están activos en tu demo.`
        : `Sé que todos estamos ocupados, así que seré breve — si necesitas ayuda o tienes alguna pregunta, solo responde y avísame. O escríbeme directamente al 407-734-0888. ¡Puedo ayudarte! Tu sitio de demo sigue activo y con gusto agendamos una llamada rápida cuando te convenga.`)
    : (step === 1
        ? `Wanted to make sure your demo${bizPart} is in your hands — it's still live and waiting for you at the link below. Take a few minutes to click around the booking flow and FAQ when you get a chance.`
        : step === 2
        ? `Quick follow-up — a couple things prospects usually ask about that I didn't cover the first time: the comforter-specific booking flow (most platforms don't have one), and the admin dashboard's "Simple mode," built for solo operators who don't want a dozen settings screens. Both are already live in your demo.`
        : `I know we're all busy, so I'll keep this brief — if you need any help or have any questions, just reply and let me know. Or message me directly at 407-734-0888. I can help! Your demo site is still live and I'm happy to jump on a quick call whenever works.`)

  const hi = lang === "es" ? `Hola ${firstName},` : `Hi ${firstName},`
  const btn = lang === "es" ? "Abrir Tu Demo →" : "Open Your Demo →"
  const sign = lang === "es" ? "— JB" : "— JB"
  const signSub = lang === "es" ? "Fundador, WashFoldKit" : "Founder, WashFoldKit"

  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#333">
      <p style="font-size:15px;line-height:1.6">${hi}</p>
      <p style="font-size:15px;line-height:1.6">${body}</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${demoUrl}" style="display:inline-block;background:#E8726A;color:white;font-weight:800;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:999px;text-transform:uppercase;letter-spacing:0.5px">
          ${btn}
        </a>
      </div>
      <p style="font-size:14px;color:#888;margin-top:24px">${sign}<br><span style="font-size:12px;color:#aaa">${signSub}</span></p>
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
