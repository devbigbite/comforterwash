"use server"

// ── Public self-signup checkout ──────────────────────────────────────────────
// The "Stan Store" style flow: a prospective tenant lands on /start, picks
// the (single) plan, fills in their business info + desired subdomain, and
// goes straight to Stripe Checkout — no super-admin involved, no manual demo
// site, no emailed link. The actual tenant (location row, starter catalog,
// admin login) gets created by the webhook once payment succeeds — see
// provisionSelfSignupTenant() in app/actions/super-admin.ts and the
// "platform_self_signup" case in app/api/stripe/webhook/route.ts.
//
// Deliberately no requireAdmin/requireSuperAdmin here — this is meant to be
// called by anyone, anonymously, from a public page.

import { stripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"
import { SELF_SIGNUP_PLAN } from "@/lib/platform-plan"

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

// ── Live availability check while the user types their subdomain ───────────
export async function checkSlugAvailable(rawSlug: string): Promise<{ available: boolean; suggestion?: string }> {
  const slug = slugify(rawSlug)
  if (!slug || slug.length < 3) return { available: false }

  const supabase = createAdminClient()
  const { data } = await supabase.from("locations").select("id").eq("slug", slug).maybeSingle()

  if (!data) return { available: true }

  // Offer a quick suggestion so the form doesn't just dead-end on "taken"
  const suggestion = `${slug}-${Math.floor(Math.random() * 900 + 100)}`
  return { available: false, suggestion }
}

// ── Kick off Checkout ────────────────────────────────────────────────────────
export async function startSelfSignup(formData: FormData): Promise<{ url?: string; error?: string }> {
  const businessName = (formData.get("business_name") as string ?? "").trim()
  const contactName   = (formData.get("contact_name") as string ?? "").trim()
  const contactEmail  = (formData.get("contact_email") as string ?? "").trim().toLowerCase()
  const contactPhone  = (formData.get("contact_phone") as string ?? "").trim()
  const rawSlug       = (formData.get("slug") as string ?? "").trim()

  if (!businessName) return { error: "Business name is required." }
  if (!contactEmail || !contactEmail.includes("@")) return { error: "Enter a valid email address." }
  if (!contactName) return { error: "Contact name is required." }

  const slug = slugify(rawSlug || businessName)
  if (!slug || slug.length < 3) return { error: "Subdomain must be at least 3 characters (letters, numbers, hyphens)." }

  const supabase = createAdminClient()
  const { data: clash } = await supabase.from("locations").select("id").eq("slug", slug).maybeSingle()
  if (clash) return { error: `"${slug}" is already taken — pick another subdomain.` }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://comforterwash.com"

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: contactEmail,
      line_items: [
        {
          // One-time setup fee — Stripe charges non-recurring line items
          // immediately at checkout, no trial involved. This fee covers
          // setup AND the tenant's first month of service.
          price_data: {
            currency: "usd",
            product_data: { name: `${SELF_SIGNUP_PLAN.name} — Setup Fee (covers first month)` },
            unit_amount: SELF_SIGNUP_PLAN.setupFeeCents,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "usd",
            product_data: { name: `${SELF_SIGNUP_PLAN.name} — Monthly Subscription` },
            unit_amount: SELF_SIGNUP_PLAN.monthlyPriceCents,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      // NOT a customer-facing free trial -- payment is captured in full at
      // checkout above. This only delays the subscription's first recurring
      // invoice by one month, since the setup fee already paid for it.
      subscription_data: {
        trial_period_days: SELF_SIGNUP_PLAN.firstMonthCoveredDays,
        metadata: { type: "platform_self_signup" },
      },
      metadata: {
        type: "platform_self_signup",
        business_name: businessName,
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        slug,
        plan_name: SELF_SIGNUP_PLAN.name,
        plan_price_cents: String(SELF_SIGNUP_PLAN.monthlyPriceCents),
      },
      success_url: `${siteUrl}/start/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/start?cancelled=1`,
    })

    if (!session.url) return { error: "Stripe did not return a checkout URL." }
    return { url: session.url }
  } catch (err) {
    console.error("[self-signup] Stripe checkout session creation failed:", err)
    return { error: err instanceof Error ? err.message : "Could not start checkout." }
  }
}
