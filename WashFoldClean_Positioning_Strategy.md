# WashFoldClean — Repositioning & Site Architecture
**From "laundry software" to "a laundry business in a box"**
Strategy doc + sitemap · August 2026

---

## 1. The core problem with the current presentation

`/platform` today sells a **tool**. The headline is "Run your laundry business on software that grows with you." That sentence assumes the reader already *has* a laundry business.

But the buyer you're actually attracting — and the one you've built all the extra support for — mostly **doesn't have a business yet**. They have an interest, a garage, a car, and a question: *can I actually make money doing this?*

That mismatch is expensive in three ways:

1. **You price like software ($199 + $99/mo) but deliver like a launch program.** The extra value (suppliers, templates, printers, social kits) is invisible at the moment of decision, so it can't justify price or defeat objections.
2. **You compete in the wrong category.** As "laundry software" you sit next to Cents, Curbside, SPOT — bigger, cheaper-looking, better funded. As "start a home laundry business," you have almost no direct competitor, and the comparison set becomes *other side-business opportunities*, where $99/mo is trivially cheap.
3. **The feature grid does the selling.** Thirteen feature cards is a checklist for someone comparing vendors. Your buyer isn't comparing vendors — they're deciding whether to take a leap.

**The reframe:** the software is not the product. The software is the *proof that the system is real*. The product is a working business.

---

## 2. The offer, restructured

Think of what you sell as three layers stacked into one purchase.

| Layer | What it is | Why it matters to the buyer |
|---|---|---|
| **1. The Engine** (software) | Branded booking site, admin, billing, dispatch, driver/operator apps | "I look like a real company on day one" |
| **2. The Playbook** (know-how) | Pricing sheets, the order-processing guide, staff manuals, route planning, how to price comforters, commercial account scripts | "I know what to actually *do* Monday morning" |
| **3. The Launch Kit** (assets + network) | Supplier list (detergent, ozone, bags, tags), print vendors, flyer/door-hanger/car-magnet templates, social media templates, promo calendars, ad copy — EN + ES | "I don't have to figure out or design anything from scratch" |

You already own most of layer 2 (`ORDER_PROCESSING_GUIDE.md`, `Staff Manuals/`, `WashFoldClean_Platform_Handbook.docx`, `/guide`). It's just buried behind login or presented as documentation instead of as *value included in the purchase*. Layer 3 is the new build — and it's mostly curation and Canva files, not engineering.

### Recommended naming

Don't invent a franchise-sounding name. Keep **WashFoldClean** as the platform brand, and name the *offer* separately:

> **WashFoldClean Launch** — everything you need to start and run a laundry pickup & delivery business from home.

Sub-labels for the three layers, used consistently everywhere:
- **The Platform** (software)
- **The Playbook** (training + operations)
- **The Launch Kit** (suppliers, templates, marketing assets)

Three words the buyer can hold in their head. Every page, every price table, every email reuses them.

### Pricing structure — one price, everything unlocked

**The angle: $199 + $99/mo gets you all of it. No tiers, no add-ons, nothing held back.**

This is the right call, and it should be stated as loudly as the price itself. Three reasons it works better than a ladder:

1. **It removes the buyer's hardest question.** A tiered page forces someone with no business yet to guess which version of a business they're going to have. They can't. So they stall, or they pick the cheapest tier and get the worst experience. One price means the only decision is *yes or no* — which is the decision you actually want them making.
2. **It's the proof that you're not nickel-and-diming.** Your buyer has been pitched by business-opportunity sellers before. Tiers, upsells, and "premium" locks are the exact shape of the thing they're afraid of. "Everything's included" is a trust signal, not just a pricing choice.
3. **It makes the price feel small by contrast.** The longer the included list, the more absurd $99/mo looks. A ladder splits that list into three shorter, weaker lists.

**Re-attribute what the money buys.** Same mechanics you already have ($199 one-time + $99/mo, Stripe, 7-day trial in `lib/platform-plan.ts`), but relabeled:

- **$199 one-time — your business, ready to open.** Branded site live, Playbook, Launch Kit, all templates, supplier directory. Not "setup." Setup is a nothing word that sounds like a fee for the privilege of paying you.
- **$99/month — everything stays running and stays current.** Platform, hosting, support, new templates as they're added, the community.

**Put the full unlock on the page as one uninterrupted list.** Not a comparison table — a comparison table implies something to compare against. One column, one checkmark per line, twenty-plus lines, with a header that says it plainly:

> **Everything below is included. There is no upgrade.**

Group the list by the three layers so it reads as a system rather than a pile, but never break it into purchasable units.

**The value anchor block.** Directly above or below that list, show what assembling this alone costs: website build, logo and brand, print design, supplier research time, a booking/billing system, a business coach. Show the stack, show the total, show your price. This is the single highest-leverage block you can add to the page, and "one price, all of it" is what makes the comparison land.

**On the trial.** With no tiers, the 7-day trial is now doing all the risk-reversal work by itself. Make sure the page says exactly what a trial user can see and do, and what happens on day 8. Ambiguity here is the main thing that will kill a one-price page.

**A note for later:** holding to one price means the only ways to grow revenue are raising it, adding operators, or selling something genuinely separate (a done-for-you setup service you *perform*, not a feature you unlock). That's a fine position to be in — just don't drift back into tiers by accident. If a feature ever ships as "Pro only," the whole trust argument above collapses.

### ⚠️ Legal flag — read this before you write earnings copy

Once you (a) charge more than ~$500 in the first six months, (b) make **any** claim about how much money a buyer can earn, and (c) provide support like supplier lists, marketing assistance, or customer-getting help — you are likely in scope of the **FTC Business Opportunity Rule**, which requires giving buyers a one-page disclosure document seven days before they pay, plus substantiation for any earnings claim. Some states (CA, FL, TX and others) layer their own business-opportunity registration on top.

This does not mean don't do it. It means: **decide deliberately whether your sales page makes income claims.** A page that says *"a branded business, ready to open, for less than a month of ads"* is very different legally from one that says *"operators make $4,000/month."* If you want to make income claims, budget for a lawyer and a disclosure doc. If you don't want that overhead yet, write the page around **capability and speed**, not dollars. I'd start there.

---

## 3. Message architecture — what the page has to say, in order

Your buyer's real objections, in the order they surface:

1. *Is this a real business or a scam?* → **Proof: you operate one yourself.** Your founder note is the strongest line on the current page and it's in 10px italic grey at the bottom of the hero. Move it up and make it the spine of the page.
2. *Can I do this without a laundromat?* → You already answer this well. Keep it as headline-adjacent, not a feature card.
3. *What do I actually do on day one?* → **A visible 30-day launch timeline.** Week 1 site live, Week 2 print + first flyers, Week 3 first customers, Week 4 first commercial pitch. This is the section that converts "interested" into "signed up," and you don't have it today.
4. *What exactly do I get?* → The three-layer stack, itemized. Not 13 undifferentiated feature cards.
5. *What if I get stuck?* → Support, community, the guide, the manuals.
6. *What does it cost, and what's the catch?* → One price, everything unlocked, nothing held back — then the trial terms and what happens if it doesn't work for them. "What's the catch" is the real question here; answer it before they ask.

**Rewrite the hero along these lines** (concept, not final copy):

> **Start a laundry pickup & delivery business from your home.**
> We're operators, not a software company. You get the same platform we run our own business on — plus the suppliers, price sheets, marketing templates, and step-by-step playbook to actually open. One price, everything included. English and Spanish.

Everything else on the page is evidence for that paragraph.

---

## 4. Proposed sitemap

Current marketing surface: `/` (consumer, Orlando), `/platform` (SaaS pitch), `/start` (checkout), `/pricing` (consumer plans), `/guide` (manual), `/pitch/[slug]`, `/apply`, `/commercial`, `/demo`.

The confusion: **`/` is a customer-facing laundry business, `/platform` is a B2B offer, and they share a domain and a header.** Long term these want separate domains (`comforterwash.com` = the Orlando business and your live proof; `washfoldclean.com` = the opportunity). Short term, at minimum, they need visually distinct shells so a visitor never wonders which company they're on.

### Opportunity site (`washfoldclean.com`, or `/platform/*` for now)

```
/                     The offer. Hero, proof, 30-day timeline, three-layer
                      stack, value anchor, price, FAQ, CTA.  ← replaces /platform

/whats-included       The three layers itemized in full.
   #platform            every feature, grouped by job-to-be-done
   #playbook            guides, manuals, pricing sheets, SOPs
   #launch-kit          suppliers, print vendors, templates, social kits

/how-it-works         The 30-day launch timeline, expanded. Day-by-day.
                      This page does more selling than the feature list.

/demo                 Live sandbox (keep — it's strong).

/pricing              One price, the full unlock list, the value stack,
                      trial terms, refund/cancel policy, FAQ. No tier
                      table — a single column with "there is no upgrade."

/faq                  Objection handling. "Do I need a laundromat?"
                      "Do I need a truck?" "Is this a franchise?"
                      "How many customers to break even?"  (careful — see legal flag)

/stories              Operator profiles. Even 2–3. Highest-value page you
                      don't have. Start with your own Orlando numbers as
                      case study #1.

/start                Checkout (exists — needs the offer reframe applied).

/guide                Public platform guide (exists, keep as trust asset).

/resources/*          Free content: "How to price a comforter wash,"
                      "Where to buy laundry bags," "First 10 customers."
                      This is your SEO + top-of-funnel engine, and it
                      doubles as proof the Playbook is real.
```

### Member area (post-purchase) — this is the piece that's missing entirely

Right now a buyer gets a dashboard. They should get a **launch hub**. This is what makes the price defensible and what stops churn in month 2.

```
/admin/launch         Onboarding checklist with progress. Gamified: the
                      30-day timeline as trackable steps.
/admin/suppliers      Vetted supplier directory — detergent, ozone units,
                      bags, tags, scales, print vendors. Links + notes on
                      what you actually use.
/admin/marketing      Downloadable templates: flyers, door hangers, car
                      magnets, business cards, social post packs, promo
                      calendar, ad copy. EN + ES versions of each.
/admin/playbook       The manuals (already exist — surface them here).
/admin/community      Where operators talk. Start as a WhatsApp or
                      Discord link. Don't build software for this.
```

Building `/admin/suppliers` + `/admin/marketing` as simple content-driven pages (Supabase table + file storage) is a small engineering lift with an outsized effect on perceived value.

### Consumer site (`comforterwash.com` / tenant sites)

No structural change. It stays exactly as it is — and it becomes **case study #1** on the opportunity site. Your best marketing asset is a real business you can point at.

---

## 5. Bilingual (EN/ES) — full i18n

You're closer than you think. `LangProvider`, `lib/i18n`, `lib/translations/en`, the locale cookie, and `LangToggle` already exist, and `/platform` already carries hand-rolled EN/ES string objects.

Recommended path:

1. **Stop hand-rolling per-page `STRINGS` objects.** Move `/platform`'s strings into `lib/translations/{en,es}` alongside the rest so there's one system, not two.
2. **Add locale to the URL** (`/es/...`) rather than cookie-only. Cookie-only means Google indexes one language, you can't share a Spanish link, and paid traffic can't land Spanish-first. This is the single most important i18n change for growth.
3. **Spanish is not a translation layer — it's half the market.** The Launch Kit templates, the Playbook, and the supplier notes all need real Spanish versions, not machine-translated ones. Budget for a human pass on anything a buyer will hand to *their* customers.
4. **Tenant sites already ship bilingual** — say so loudly on the sales page. For a Spanish-speaking operator serving a mixed market, "your customer site works in both languages out of the box" is a genuine differentiator, not a feature card.

---

## 6. What I'd do, in order

**Phase 1 — reposition (no new features)**
1. Rewrite `/platform` around the three-layer offer + the 30-day timeline + value anchor.
2. Relabel the pricing so the one-time fee buys the Launch Kit, not "setup" — and add the full "everything included, there is no upgrade" unlock list + value anchor.
3. Add `/how-it-works` and `/stories` (start with your own business as the case study).
4. Decide the earnings-claims question and write to it.

**Phase 2 — make the promise real**
5. Build the Launch Kit: supplier directory, 6–10 print/social templates in Canva, EN + ES.
6. Ship `/admin/launch`, `/admin/suppliers`, `/admin/marketing`.
7. Move `/platform` strings into the shared i18n system; add `/es` URL routing.

**Phase 3 — leverage**
8. `/resources/*` content engine for SEO and top-of-funnel.
9. If you add revenue, add it as a *separate service you perform* (done-for-you setup, live coaching) — never as a feature unlock inside the product.
10. Split domains: `washfoldclean.com` for the opportunity, `comforterwash.com` for the proof.

---

## 7. The one-sentence test

If a stranger reads only your headline, they should be able to finish this sentence correctly:

> *"WashFoldClean is how you ______."*

Today the honest answer is *"…run laundry software."*
It should be *"…start a laundry business from your house without figuring it out alone."*

Every decision in this doc is downstream of making that sentence true.
