-- ============================================================
-- Commercial Outreach Module
-- Run once in Supabase SQL editor
-- ============================================================

-- Customer segment types for pitch templates
CREATE TYPE IF NOT EXISTS outreach_segment AS ENUM (
  'airbnb_property_manager',
  'hotel_bnb',
  'corporate_office',
  'government_institutional',
  'fitness_spa',
  'other'
);

-- Pipeline stages
CREATE TYPE IF NOT EXISTS prospect_stage AS ENUM (
  'cold',
  'contacted',
  'interested',
  'proposal_sent',
  'negotiating',
  'closed_won',
  'closed_lost'
);

-- ============================================================
-- Pitch Templates
-- One template per customer segment, customized messaging
-- ============================================================
CREATE TABLE IF NOT EXISTS commercial_pitch_templates (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug          text UNIQUE NOT NULL,
  title         text NOT NULL,
  segment       outreach_segment NOT NULL DEFAULT 'other',
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  tagline       text,
  -- Proposal content blocks (stored as JSON for flexibility)
  cover_headline    text,
  intro_paragraph   text,
  services_offered  jsonb DEFAULT '[]'::jsonb,   -- [{name, description, price_note}]
  value_props       jsonb DEFAULT '[]'::jsonb,   -- [{icon, title, body}]
  pricing_table     jsonb DEFAULT '[]'::jsonb,   -- [{item, unit, price, notes}]
  closing_statement text,
  -- Metadata
  view_count    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Prospects (Pipeline)
-- Each prospect can be linked to a pitch template
-- ============================================================
CREATE TABLE IF NOT EXISTS commercial_prospects (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name   text NOT NULL,
  contact_name    text,
  phone           text,
  email           text,
  address         text,
  segment         outreach_segment NOT NULL DEFAULT 'other',
  stage           prospect_stage NOT NULL DEFAULT 'cold',
  pitch_template_id uuid REFERENCES commercial_pitch_templates(id) ON DELETE SET NULL,
  -- Proposal tracking
  proposal_sent_at  timestamptz,
  proposal_viewed_at timestamptz,
  -- Estimated deal value
  estimated_lbs_per_week  numeric,
  estimated_monthly_value numeric,
  -- Notes & follow-up
  notes           text,
  next_follow_up  date,
  assigned_to     text,  -- staff name / email
  -- Metadata
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Proposal view tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS commercial_proposal_views (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id     uuid REFERENCES commercial_prospects(id) ON DELETE CASCADE,
  template_id     uuid REFERENCES commercial_pitch_templates(id) ON DELETE CASCADE,
  viewed_at       timestamptz NOT NULL DEFAULT now(),
  ip_address      text,
  user_agent      text
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ language 'plpgsql';

CREATE TRIGGER update_pitch_templates_updated_at
  BEFORE UPDATE ON commercial_pitch_templates
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_prospects_updated_at
  BEFORE UPDATE ON commercial_prospects
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================
-- Seed: Default pitch templates for each segment
-- ============================================================
INSERT INTO commercial_pitch_templates (slug, title, segment, status, tagline, cover_headline, intro_paragraph, services_offered, value_props, pricing_table, closing_statement)
VALUES
(
  'airbnb-property-managers',
  'Airbnb & Short-Term Rental Managers',
  'airbnb_property_manager',
  'draft',
  'Hotel-quality linens, ready for every guest turnover.',
  'Professional Linen Service for Short-Term Rental Managers',
  'WashFold Orlando provides dedicated pickup and delivery linen care for property managers operating short-term rentals in the greater Orlando area. We understand that fast turnovers, consistent quality, and reliable schedules are the backbone of your 5-star ratings. Our service eliminates in-unit laundry bottlenecks so your team can focus on guest experience.',
  '[
    {"name": "Scheduled Pickup & Delivery", "description": "Twice-weekly routes cover most Orlando ZIP codes. We pick up dirty linens and return freshly laundered sets — coordinated around your turnover schedule.", "price_note": "Included in per-pound rate"},
    {"name": "Wash, Dry & Fold", "description": "Commercial-grade processing with hospitality detergents. All items sorted, folded, and packaged per property.", "price_note": "Per pound"},
    {"name": "Comforter & Duvet Care", "description": "Bulky items handled in industrial machines — no shrinkage, no damage.", "price_note": "Per item or per pound"}
  ]',
  '[
    {"icon": "🕐", "title": "Fast Turnaround", "body": "24-48 hour cycle keeps your supply flowing even during peak season."},
    {"icon": "🏨", "title": "Hospitality-Grade Quality", "body": "Commercial detergents, proper water temperatures, and professional folding — the same standard top hotels demand."},
    {"icon": "🚐", "title": "Dedicated Route Driver", "body": "Same driver, same schedule. Your linens are never commingled with other commercial clients."},
    {"icon": "📦", "title": "Labeled & Organized", "body": "Returns packaged by property address so your team knows exactly what goes where."}
  ]',
  '[
    {"item": "Wash & Fold (sheets, towels, pillowcases)", "unit": "per lb", "price": "Contact for quote", "notes": "Volume discounts available at 50+ lbs/week"},
    {"item": "Comforters / Duvets", "unit": "per item", "price": "Contact for quote", "notes": "King, Queen, Full sizes"},
    {"item": "Pickup & Delivery", "unit": "per route stop", "price": "Included", "notes": "Minimum weekly volume applies"}
  ]',
  'We are ready to schedule a no-obligation walkthrough or trial service. Contact us to discuss your property count, weekly linen volume, and turnover schedule so we can build a plan that works for your operation.'
),
(
  'hotels-bnb',
  'Hotels & Bed & Breakfasts',
  'hotel_bnb',
  'draft',
  'Reliable commercial laundry that keeps your rooms ready.',
  'Commercial Linen Service for Hotels & Bed & Breakfasts',
  'WashFold Orlando partners with small and mid-size hotels, motels, and bed & breakfasts across the Orlando area to provide consistent, high-volume linen processing. We serve as a reliable outsourced laundry department — giving you the quality control of in-house laundry without the labor, equipment, and utility costs.',
  '[
    {"name": "Sheets & Pillowcases", "description": "Processed in dedicated commercial batches. Folded to hotel standard.", "price_note": "Per pound"},
    {"name": "Towels & Bath Linens", "description": "Full wash, dry, and fold cycle with commercial softeners.", "price_note": "Per pound"},
    {"name": "Comforters & Bedspreads", "description": "Industrial washing for oversized items.", "price_note": "Per item"},
    {"name": "Scheduled Route Service", "description": "Daily or twice-weekly routes based on your room count and occupancy.", "price_note": "Included"}
  ]',
  '[
    {"icon": "⚙️", "title": "Eliminate Equipment Costs", "body": "No capital expense on commercial washers and dryers. No utility spikes. No maintenance headaches."},
    {"icon": "👷", "title": "Reduce Labor", "body": "Free your housekeeping staff from laundry duty. They focus on rooms; we handle the wash."},
    {"icon": "✅", "title": "Consistent Quality", "body": "Every batch processed to the same standard — no variability between shifts or staff."},
    {"icon": "📋", "title": "Weight-Based Invoicing", "body": "Simple, transparent billing by the pound. You pay for what you send."}
  ]',
  '[
    {"item": "Sheets & Pillowcases", "unit": "per lb", "price": "Contact for quote", "notes": ""},
    {"item": "Towels & Bath Linens", "unit": "per lb", "price": "Contact for quote", "notes": ""},
    {"item": "Comforters", "unit": "per item", "price": "Contact for quote", "notes": "King / Queen / Full"},
    {"item": "Route Pickup & Delivery", "unit": "per visit", "price": "Included", "notes": "Daily routes available for 20+ rooms"}
  ]',
  'Let''s schedule a facility visit and trial run. We will assess your current linen volume, discuss service frequency, and provide a firm per-pound quote with no long-term commitment required for the trial period.'
),
(
  'government-institutional',
  'Government & Institutional Facilities',
  'government_institutional',
  'draft',
  'Compliant, documented, and reliable linen processing for regulated facilities.',
  'Commercial Laundry Services for Government & Institutional Facilities',
  'WashFold Orlando (operating trade name of SaleCalle LLC) provides commercial linen processing services to government agencies, veteran facilities, healthcare-adjacent organizations, and institutional clients in the Orlando metropolitan area. We understand the requirements of formal procurement processes and are prepared to respond to RFPs, provide documentation, and meet performance work statement specifications.',
  '[
    {"name": "Segregated Batch Processing", "description": "Client linen is never commingled. Processed in dedicated batches with full chain-of-custody documentation.", "price_note": "Per pound"},
    {"name": "Scheduled Pickup & Delivery", "description": "Fixed-day service schedules with signed delivery receipts and item counts per visit.", "price_note": "Included"},
    {"name": "Written Reporting", "description": "Monthly service reports detailing pickup dates, weights, item counts, and delivery confirmations.", "price_note": "Included"},
    {"name": "Emergency Backup Service", "description": "Designated backup facilities and vehicles to maintain continuity in the event of equipment failure.", "price_note": "Included"}
  ]',
  '[
    {"icon": "📄", "title": "Documentation Ready", "body": "Signed receipts, item logs, and monthly reports provided as standard — not optional add-ons."},
    {"icon": "🏗️", "title": "Backup Infrastructure", "body": "Two designated secondary processing facilities and a backup vehicle on standby."},
    {"icon": "🔒", "title": "Segregated Processing", "body": "Your linen is never mixed with healthcare, VA, or other institutional clients."},
    {"icon": "✅", "title": "Licensed & Insured", "body": "Florida-licensed commercial laundry operation with active general liability insurance."}
  ]',
  '[
    {"item": "Linen Processing (all types)", "unit": "per lb", "price": "Contact for quote", "notes": "Pricing based on PWS volume specifications"},
    {"item": "Scheduled Route Service", "unit": "per visit", "price": "Included", "notes": ""},
    {"item": "Emergency Pickup", "unit": "per occurrence", "price": "Included", "notes": "Same-day response"},
    {"item": "Monthly Reporting Package", "unit": "per month", "price": "Included", "notes": ""}
  ]',
  'WashFold Orlando is prepared to respond to formal RFPs or Requests for Quote. We can provide facility documentation, insurance certificates, and references upon request. Please contact us to discuss your procurement timeline and service requirements.'
)
ON CONFLICT (slug) DO NOTHING;
