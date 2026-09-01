"use server"

// ── Phase 4: per-tenant platform billing ──────────────────────────────────────
// Each tenant location can be put on a flat monthly Stripe subscription. This
// is billing FOR the tenant (what they pay to use the SaaS), distinct from
// app/actions/subscriptions.ts which handles a tenant's own CUSTOMERS paying
// for recurring laundry plans.
//
// Flow: super-admin sets a monthly price on a location, generates a Stripe
// Checkout link, and sends it to the tenant. The tenant enters their own card
// on Stripe's hosted page — we never touch card data. The webhook
// (app/api/stripe/webhook/route.ts) marks the location active once payment
// succeeds and keeps billing_status in sync afterward.

import { stripe } from "@/lib/stripe"
import { Resend } from "resend"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireSuperAdmin, requireAdmin } from "@/lib/auth-guard"
import { getLocationId, ORLANDO_LOCATION_ID } from "@/lib/location"
import { revalidatePath } from "next/cache"

const resend = new Resend(process.env.RESEND_API_KEY ?? "re_missing")

export interface LocationBilling {
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  billing_status: "none" | "trialing" | "active" | "past_due" | "canceled"
  plan_price_cents: number | null
  plan_name: string | null
}

export async function getLocationBilling(locationId: string): Promise<LocationBilling | null> {
  await requireSuperAdmin()
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("locations")
    .select("stripe_customer_id, stripe_subscription_id, billing_status, plan_price_cents, plan_name")
    .eq("id", locationId)
    .single()
  return data as LocationBilling | null
}

// Sets (or updates) the flat monthly price for a tenant without touching
// Stripe — the actual subscription is created once the tenant completes
// the checkout link below.
export async function setLocationPlanPrice(
  locationId: string,
  planName: string,
  planPriceCents: number,
): Promise<{ error?: string }> {
  await requireSuperAdmin()
  if (planPriceCents < 0) return { error: "Price can't be negative" }
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("locations")
    .update({ plan_name: planName.trim() || null, plan_price_cents: planPriceCents })
    .eq("id", locationId)
  if (error) return { error: error.message }
  revalidatePath("/super-admin")
  return {}
}

// Creates a Stripe Checkout session (subscription mode) for the tenant's
// flat monthly price. Returns a URL the super-admin can send to the tenant.
export async function createBillingCheckoutLink(locationId: string): Promise<{ url?: string; error?: string }> {
  await requireSuperAdmin()
  const supabase = createAdminClient()
  const { data: loc } = await supabase
    .from("locations")
    .select("id, name, plan_name, plan_price_cents, stripe_customer_id")
    .eq("id", locationId)
    .single()

  if (!loc) return { error: "Location not found" }
  if (!loc.plan_price_cents || loc.plan_price_cents <= 0) {
    return { error: "Set a monthly plan price for this location first." }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://comforterwash.com"

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: loc.stripe_customer_id ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `${loc.plan_name || "Platform"} — Monthly Subscription (${loc.name})` },
          unit_amount: loc.plan_price_cents,
          recurring: { interval: "month" },
        },
        quantity: 1,
      },
    ],
    metadata: { type: "platform_subscription", location_id: loc.id },
    subscription_data: { metadata: { type: "platform_subscription", location_id: loc.id } },
    success_url: `${siteUrl}/super-admin?billing=success`,
    cancel_url: `${siteUrl}/super-admin?billing=cancelled`,
  })

  if (!session.url) return { error: "Stripe did not return a checkout URL" }
  return { url: session.url }
}

// Emails a previously-generated checkout link straight to a tenant contact.
// createBillingCheckoutLink only returns the URL — this is the separate,
// explicit "actually send it" step, mirroring sendSignupLinkToLead's send
// logic but for an existing tenant location rather than a demo lead. The
// checkout URL is passed in (not regenerated here) so this always emails
// exactly the link the super-admin saw on screen and can re-send an
// already-generated link without creating a second Stripe Checkout session.
export async function sendBillingCheckoutEmail(
  locationId: string,
  toEmail: string,
  checkoutUrl: string,
): Promise<{ error?: string; success?: true }> {
  await requireSuperAdmin()

  if (!toEmail.trim() || !toEmail.includes("@")) return { error: "Enter a valid email address" }
  if (!checkoutUrl) return { error: "Generate a checkout link first" }

  const supabase = createAdminClient()
  const { data: loc } = await supabase
    .from("locations")
    .select("name, plan_name, plan_price_cents")
    .eq("id", locationId)
    .single()
  if (!loc) return { error: "Location not found" }

  // No language field on locations itself -- fall back to the preferred_language
  // recorded on the demo request that originally spun up this tenant, if any.
  const { data: originatingRequest } = await supabase
    .from("platform_demo_requests")
    .select("preferred_language")
    .eq("demo_location_id", locationId)
    .maybeSingle()
  const lang: "en" | "es" = originatingRequest?.preferred_language === "es" ? "es" : "en"

  const priceDisplay = loc.plan_price_cents ? ` ($${(loc.plan_price_cents / 100).toFixed(2)}/mo)` : ""

  const subject = lang === "es"
    ? `${loc.name} — tu enlace de facturación de WashFoldKit`
    : `${loc.name} — your WashFoldKit billing checkout link`

  const html = lang === "es" ? `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#333">
        <p style="font-size:15px;line-height:1.6">Hola,</p>
        <p style="font-size:15px;line-height:1.6">
          Aquí tienes el enlace de pago para configurar la facturación de <strong>${loc.name}</strong> en el
          plan <strong>${loc.plan_name || "Platform"}</strong>${priceDisplay}. Ingresa tu tarjeta en la página
          segura de Stripe — nunca vemos ni almacenamos los datos de tu tarjeta.
        </p>
        <div style="text-align:center;margin:24px 0">
          <a href="${checkoutUrl}" style="display:inline-block;background:#E8726A;color:white;font-weight:800;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:999px;text-transform:uppercase;letter-spacing:0.5px">
            Completar Configuración de Facturación →
          </a>
        </div>
        <p style="font-size:14px;color:#888;line-height:1.6">
          ¿Preguntas? Solo responde a este correo, o escríbeme por WhatsApp al 407-734-0888.
        </p>
        <p style="font-size:14px;color:#888;margin-top:24px">— JB<br><span style="font-size:12px;color:#aaa">Fundador, WashFoldKit</span></p>
      </div>
    ` : `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#333">
        <p style="font-size:15px;line-height:1.6">Hi,</p>
        <p style="font-size:15px;line-height:1.6">
          Here's the checkout link to set up billing for <strong>${loc.name}</strong> on the
          <strong>${loc.plan_name || "Platform"}</strong> plan${priceDisplay}. Enter your card on
          Stripe's secure page — we never see or store your card details.
        </p>
        <div style="text-align:center;margin:24px 0">
          <a href="${checkoutUrl}" style="display:inline-block;background:#E8726A;color:white;font-weight:800;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:999px;text-transform:uppercase;letter-spacing:0.5px">
            Complete Billing Setup →
          </a>
        </div>
        <p style="font-size:14px;color:#888;line-height:1.6">
          Questions? Just reply to this email, or reach me on WhatsApp at 407-734-0888.
        </p>
        <p style="font-size:14px;color:#888;margin-top:24px">— JB<br><span style="font-size:12px;color:#aaa">Founder, WashFoldKit</span></p>
      </div>
    `

  const result = await resend.emails.send({
    from: "WashFoldKit <clean@washfoldorlando.com>",
    to: [toEmail.trim()],
    subject,
    html,
  })

  if (result.error) return { error: result.error.message }
  return { success: true }
}

// Read-only billing-status check for a tenant's own admin (not super-admin) —
// used to show a soft banner if their platform subscription lapses. Orlando
// is the original owner-operated business, not a paying tenant of itself, so
// it's always exempt regardless of its billing_status value.
export async function getMyBillingStatus(): Promise<"none" | "trialing" | "active" | "past_due" | "canceled" | "exempt"> {
  await requireAdmin()
  const locationId = await getLocationId()
  if (locationId === ORLANDO_LOCATION_ID) return "exempt"
  const supabase = createAdminClient()
  const { data } = await supabase.from("locations").select("billing_status").eq("id", locationId).single()
  return (data?.billing_status as "none" | "trialing" | "active" | "past_due" | "canceled") ?? "none"
}

// Separate from billing_status -- a location can be paused for a
// non-billing reason too (see pauseLocation in app/actions/super-admin.ts),
// so this is checked independently rather than folded into the billing
// banner. Public site is already blocked by middleware.ts's
// isLocationPaused; this just lets the tenant SEE why from their own
// dashboard instead of only discovering it from a customer complaint.
export async function getMyPauseStatus(): Promise<{ paused: boolean; reason: string | null }> {
  await requireAdmin()
  const locationId = await getLocationId()
  const supabase = createAdminClient()
  const { data } = await supabase.from("locations").select("paused, paused_reason").eq("id", locationId).single()
  return { paused: data?.paused === true, reason: data?.paused_reason ?? null }
}

// ── Sales funnel: send a signup/checkout link to a demo-request lead ──────
// Sets the plan price on their demo tenant (if given), generates the Stripe
// Checkout link via createBillingCheckoutLink above, and emails it straight
// to the lead — this is the "invoicing" step in the sales flow: converting
// a demo into an actual paid subscription. Marking the lead "won" happens
// automatically off the Stripe webhook once they actually complete checkout
// (see app/api/stripe/webhook/route.ts), not here — this only sends the link.
export async function sendSignupLinkToLead(params: {
  requestId: string
  leadEmail: string
  leadName: string
  business?: string | null
  locationId: string
  planName: string
  planPriceCents: number
}): Promise<{ error?: string; success?: true }> {
  await requireSuperAdmin()

  const priceResult = await setLocationPlanPrice(params.locationId, params.planName, params.planPriceCents)
  if (priceResult.error) return { error: priceResult.error }

  const linkResult = await createBillingCheckoutLink(params.locationId)
  if (linkResult.error || !linkResult.url) return { error: linkResult.error ?? "Could not generate checkout link" }

  const supabase = createAdminClient()
  const { data: req } = await supabase
    .from("platform_demo_requests")
    .select("status, preferred_language")
    .eq("id", params.requestId)
    .single()
  const lang: "en" | "es" = req?.preferred_language === "es" ? "es" : "en"

  const firstName = params.leadName.trim().split(" ")[0] || params.leadName
  const bizPart = params.business ? (lang === "es" ? ` de ${params.business}` : ` for ${params.business}`) : ""
  const priceDisplay = `$${(params.planPriceCents / 100).toFixed(2)}/mo`

  const subject = lang === "es"
    ? `${firstName}, aquí tienes tu enlace de registro de WashFoldKit`
    : `${firstName}, here's your WashFoldKit signup link`

  const html = lang === "es" ? `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#333">
        <p style="font-size:15px;line-height:1.6">Hola ${firstName},</p>
        <p style="font-size:15px;line-height:1.6">
          ¿Listo para seguir adelante${bizPart}? Aquí tienes tu enlace de registro para el plan
          <strong>${params.planName}</strong> (${priceDisplay}) — tu sitio de demo se convierte en tu sitio real
          y en vivo en el momento en que completes el pago, sin nada que migrar ni reconfigurar.
        </p>
        <div style="text-align:center;margin:24px 0">
          <a href="${linkResult.url}" style="display:inline-block;background:#E8726A;color:white;font-weight:800;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:999px;text-transform:uppercase;letter-spacing:0.5px">
            Completar Registro →
          </a>
        </div>
        <p style="font-size:14px;color:#888;line-height:1.6">
          ¿Preguntas antes de registrarte? Solo responde a este correo, o escríbeme por WhatsApp al 407-734-0888.
        </p>
        <p style="font-size:14px;color:#888;margin-top:24px">— JB<br><span style="font-size:12px;color:#aaa">Fundador, WashFoldKit</span></p>
      </div>
    ` : `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#333">
        <p style="font-size:15px;line-height:1.6">Hi ${firstName},</p>
        <p style="font-size:15px;line-height:1.6">
          Ready to move forward${bizPart}? Here's your signup link for the <strong>${params.planName}</strong> plan
          (${priceDisplay}) — your demo site becomes your real, live site the moment you complete checkout, nothing
          to migrate or reconfigure.
        </p>
        <div style="text-align:center;margin:24px 0">
          <a href="${linkResult.url}" style="display:inline-block;background:#E8726A;color:white;font-weight:800;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:999px;text-transform:uppercase;letter-spacing:0.5px">
            Complete Signup →
          </a>
        </div>
        <p style="font-size:14px;color:#888;line-height:1.6">
          Questions before you sign up? Just reply to this email, or reach me on WhatsApp at 407-734-0888.
        </p>
        <p style="font-size:14px;color:#888;margin-top:24px">— JB<br><span style="font-size:12px;color:#aaa">Founder, WashFoldKit</span></p>
      </div>
    `

  const result = await resend.emails.send({
    from: "WashFoldKit <clean@washfoldorlando.com>",
    to: [params.leadEmail],
    subject,
    html,
  })

  if (result.error) return { error: result.error.message }

  // Move the funnel entry to "negotiating" if it isn't further along already
  // (won/lost) — sending a signup link is a clear signal a deal is active.
  if (req && req.status !== "won" && req.status !== "lost") {
    await supabase
      .from("platform_demo_requests")
      .update({ status: "negotiating", updated_at: new Date().toISOString() })
      .eq("id", params.requestId)
  }

  const { logAutomatedActivity } = await import("@/app/actions/platform-demo-activities")
  await logAutomatedActivity(params.requestId, "email_sent", `Signup link sent — ${params.planName} plan, $${(params.planPriceCents / 100).toFixed(2)}/mo`)

  revalidatePath("/super-admin/demo-requests")
  return { success: true }
}

// Cancels a tenant's platform subscription immediately (e.g. offboarding).
export async function cancelLocationBilling(locationId: string): Promise<{ error?: string }> {
  await requireSuperAdmin()
  const supabase = createAdminClient()
  const { data: loc } = await supabase.from("locations").select("stripe_subscription_id").eq("id", locationId).single()
  if (!loc?.stripe_subscription_id) return { error: "No active subscription for this location" }

  try {
    await stripe.subscriptions.cancel(loc.stripe_subscription_id)
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to cancel in Stripe" }
  }

  await supabase.from("locations").update({ billing_status: "canceled" }).eq("id", locationId)
  revalidatePath("/super-admin")
  return {}
}
