# New Tenant Onboarding

The process for taking a signed SaaS customer from "paid" to "operating." Work
top to bottom — the blockers genuinely block, and everything below them is
wasted effort until they're cleared.

Track progress at **`/super-admin/readiness`**, which computes this checklist
live for every tenant.

---

## 0. Before you start: know which flow created them

Two paths produce a tenant, and they leave the record in different states.

**Self-signup** (`/start` → Stripe Checkout → webhook): creates the `locations`
row with `billing_status: trialing`, seeds the service catalog and email
templates, creates the admin user, and emails a magic sign-in link. Billing is
already running.

**Demo/sales path** (`/super-admin` → New Location, or a demo request that
generated a site): creates the row with `plan: demo` and `billing_status: none`.
**Nothing about billing is set up**, and if `createLocation` was used without
following up with `inviteLocationAdmin`, nobody can log in at all.

Most signed customers arrive through the second path, having explored a demo
site first. Assume nothing is configured until the readiness page says so.

---

## 1. Blockers — the tenant cannot operate without these

### 1.1 Admin login exists

Someone must be linked in `location_users`, or the tenant literally cannot
reach `/admin`. Check the readiness page; if missing, use **Locations → Admins
→ Invite** in super-admin. This sends them a magic link.

### 1.2 Stripe Connect completed

`stripe_connect_required` defaults to `true`, and until
`stripe_connect_status` is `active`, `startCheckoutSession` refuses to create a
session — every customer sees *"This business hasn't finished setting up online
payments yet."* No payments, no business.

Only the tenant can do this: **their** `/admin/branding → Get Paid Directly`.
They'll need legal business name, EIN or SSN, business address, bank details,
and photo ID. Tell them to budget ten minutes.

### 1.3 Support email set

`locations.support_email` is where new-order, abandoned-checkout and
date-conflict alerts go. **With it blank, those alerts fall back to the platform
inbox and the tenant is never told they have an order.** Set it before they take
their first booking, not after.

---

## 2. Billing — make sure we're actually being paid

For anyone who didn't come through self-signup:

1. **Locations → Billing → set plan name and price**
2. **Create checkout link**, then **send it to them by email**
3. Confirm `billing_status` flips to `active` (the Stripe webhook does this)
4. If they came from a demo request, mark that request **won** in
   `/super-admin/demo-requests` so they stop receiving sales follow-ups

A one-off setup fee paid through a manual payment link does **not** update
`plan` or `billing_status` — the webhook only fires for the self-signup and
subscription checkout flows. Check the record by hand if a setup fee was paid
separately.

---

## 3. Configuration the tenant supplies

Request all of this in the welcome email so it arrives in one round trip.

| Item | Where it goes | Consequence if skipped |
|---|---|---|
| Support email | `/admin/branding` | See 1.3 — this is a blocker |
| Support phone | `/admin/branding` | Missing from site and email footers |
| Logo, brand colors | `/admin/branding` | Generic unbranded site |
| Service ZIP codes | `/admin/zip-codes` | ZIP checker tells every visitor they're out of range |
| Pricing | `/admin/pricing` | Falls back to platform defaults — functional, but probably wrong for their market |
| Operating mode (facility / home) | `/admin/branding` | Defaults to facility; routing assumes a facility exists |
| Fulfillment mode (delivery / walk-in / both) | `/admin/branding` | Defaults may not match how they work |
| Facility or laundromat record | `/admin/facilities` | In facility mode, orders never get assigned one — Facility Board and transfer runs stay empty |
| Staff names and roles | `/admin/workers` | No driver or operator logins, no clock-in PINs |

---

## 4. Domain and email deliverability

### 4.1 Custom domain — order of operations matters

New tenants run on `<slug>.washfold.com`. To move them to their own domain:

1. Set `custom_domain` on the location record **first** (super-admin → Edit)
2. Add the domain in Vercel
3. Only then have them point DNS

Getting this backwards is a real failure mode: `middleware.ts` falls back to
**WashFold Orlando** for an unrecognized custom domain, so their visitors land
on Orlando's live site rather than an error page.

**Tell the tenant upfront: their custom domain only covers the customer-facing
site.** `/admin` and `/super-admin` always redirect to `comforterwash.com`
regardless of which domain — subdomain or their own — they were on, because
login sessions can't be shared across separate root domains. This is
intentional (see `middleware.ts`, `CANONICAL_ADMIN_HOST`), not a bug, but a
tenant who isn't told in advance will reasonably assume something's broken
when their own domain "kicks them out" to ours during login. Mention it in
the same conversation where you set up their domain, not after they notice.

### 4.2 Sending domain

Until a tenant verifies their own domain, all their customer email goes out from
the shared platform address with their business name as the display name. It
works, but it reads as someone else's address.

They fix it themselves at `/admin/branding → Custom Sending Domain`: enter a
domain (a subdomain like `mail.theirbusiness.com` is fine), Resend returns DNS
records, they add them, status flips to `verified`. After that, mail sends from
`hello@theirdomain`.

### 4.3 Email templates

Provisioning seeds six editable templates (booking confirmation, pickup
reminder, picked up, out for delivery, delivered, admin new-order alert). If a
tenant's `/admin/templates` is empty, `seedNewLocation` didn't run for them —
reseed rather than leaving them with nothing to edit. Email still sends either
way, using hardcoded defaults.

---

## 5. Dispatch

Driver dispatch and live tracking run on Shipday, and each tenant needs **their
own** account and API key — only WashFold Orlando falls back to shared platform
credentials. Without a key, dispatch silently does nothing.

They add it at `/admin/branding → Dispatch`, along with the business address and
phone Shipday shows to drivers.

---

## 5b. One-time platform setup: the Connect webhook

Tenant-customer payments are **direct charges** created on the tenant's own
connected account, so Stripe fires their events against that account rather
than the platform. Those events need their own endpoint:

1. Stripe Dashboard → Developers → Webhooks → **Add endpoint**
2. URL: `https://comforterwash.com/api/stripe/connect-webhook`
3. Listen to: **Events on connected accounts** (not "Events on your account")
4. Select: `checkout.session.completed`, `checkout.session.expired`,
   `payment_intent.payment_failed`
5. Copy the signing secret into Vercel as **`STRIPE_CONNECT_WEBHOOK_SECRET`**

Without this, the platform still works — the booking is created client-side the
moment Stripe reports success — but the safety net for a customer whose browser
dies mid-payment is gone, and expired/failed checkouts stop being recorded for
connected tenants.

The existing `/api/stripe/webhook` endpoint stays exactly as it is: it handles
the platform's own money (SaaS subscriptions, self-signup) and must remain on
"Events on your account".

**Still on the platform account (phase 2):** commercial-account billing, monthly
plan subscriptions, and misc fees. For a connected tenant those charges route
through the platform as destination charges, which means we pay the Stripe fee
on them. Migrating them means moving each flow's saved card onto the connected
account first.

## 6. Known platform-wide gaps

Things that are not per-tenant yet. Say them out loud during onboarding rather
than letting a tenant discover them.

**SMS sends from one shared number.** Every tenant's customer texts go out from
the platform's single Twilio number. Replies and STOP requests land with us, not
them, and the A2P 10DLC campaign is registered to our brand. Fine at low volume;
needs per-tenant Twilio subaccounts before this scales.

**Support is email-only.** `getEmailBranding` resolves the support address to
the shared inbox regardless of the tenant's own `support_email`.

---

## 7. Before you call it done

- Place a real test booking on their site end to end — book, pay, weigh in,
  deliver — and confirm the customer emails arrive and the order alert reaches
  **their** inbox, not ours
- Confirm `/super-admin/readiness` shows no blockers for them
- Walk them through Dispatch, Orders, and Reports on a call; the screens make
  far more sense with one real order in the system
