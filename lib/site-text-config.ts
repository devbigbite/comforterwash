/**
 * Default text values for the hero carousel slides and Why Choose Us section.
 * Keys map to `settings` table rows prefixed with `txt_`.
 * _es suffix = Spanish admin override (falls back to translation if empty).
 */

export interface SiteText {
  // Slide 1 — EN
  slide_1_headline: string
  slide_1_subline: string
  slide_1_cta: string
  // Slide 1 — ES
  slide_1_headline_es: string
  slide_1_subline_es: string
  slide_1_cta_es: string
  // Slide 2 — step panels — EN
  slide_2_p1_label: string
  slide_2_p1_desc: string
  slide_2_p2_label: string
  slide_2_p2_desc: string
  slide_2_p3_label: string
  slide_2_p3_desc: string
  // Slide 2 — step panels — ES
  slide_2_p1_label_es: string
  slide_2_p1_desc_es: string
  slide_2_p2_label_es: string
  slide_2_p2_desc_es: string
  slide_2_p3_label_es: string
  slide_2_p3_desc_es: string
  // Slide 3 — EN
  slide_3_headline: string
  slide_3_subline: string
  slide_3_cta: string
  // Slide 3 — ES
  slide_3_headline_es: string
  slide_3_subline_es: string
  slide_3_cta_es: string
  // Why Choose Us — EN
  why_heading: string
  why_subheading: string
  why_body1: string
  why_body2: string
  // Why Choose Us photo overlay — EN
  why_photo_tag: string
  why_photo_headline: string
  why_photo_cta: string
  // Why Choose Us — ES
  why_heading_es: string
  why_subheading_es: string
  why_body1_es: string
  why_body2_es: string
  // Why Choose Us photo overlay — ES
  why_photo_tag_es: string
  why_photo_headline_es: string
  why_photo_cta_es: string
  // Monthly Plans CTA — EN
  plans_heading: string
  plans_body: string
  // Monthly Plans CTA — ES
  plans_heading_es: string
  plans_body_es: string
  // Testimonials — EN (empty = falls back to translation string)
  t1_quote: string
  t1_name: string
  t1_label: string
  t2_quote: string
  t2_name: string
  t2_label: string
  t3_quote: string
  t3_name: string
  t3_label: string
  // Testimonials — ES
  t1_quote_es: string
  t1_name_es: string
  t1_label_es: string
  t2_quote_es: string
  t2_name_es: string
  t2_label_es: string
  t3_quote_es: string
  t3_name_es: string
  t3_label_es: string
}

export const DEFAULT_TEXT: SiteText = {
  slide_1_headline: "Laundry Service That Feels Like Family",
  slide_1_subline:  "Free pickup & delivery · Wash, fold & comforter cleaning · Orlando FL",
  slide_1_cta:      "Schedule a Pickup",
  slide_1_headline_es: "",
  slide_1_subline_es:  "",
  slide_1_cta_es:      "",

  slide_2_p1_label: "ORDER",
  slide_2_p1_desc:  "Schedule your pickup in seconds",
  slide_2_p2_label: "WE PICK UP",
  slide_2_p2_desc:  "We pick up your laundry right from your door",
  slide_2_p3_label: "WE DELIVER",
  slide_2_p3_desc:  "Fresh, clean & folded delivered to you",
  slide_2_p1_label_es: "",
  slide_2_p1_desc_es:  "",
  slide_2_p2_label_es: "",
  slide_2_p2_desc_es:  "",
  slide_2_p3_label_es: "",
  slide_2_p3_desc_es:  "",

  slide_3_headline: "We Come to You. You Enjoy Life.",
  slide_3_subline:  "Professional wash & fold starting at $2.40/lb · Comforters from $35",
  slide_3_cta:      "See Pricing",
  slide_3_headline_es: "",
  slide_3_subline_es:  "",
  slide_3_cta_es:      "",

  // Why section — empty = falls back to translation string
  why_heading:    "",
  why_subheading: "",
  why_body1:      "",
  why_body2:      "",
  why_photo_tag:      "",
  why_photo_headline: "",
  why_photo_cta:      "",
  why_heading_es:    "",
  why_subheading_es: "",
  why_body1_es:      "",
  why_body2_es:      "",
  why_photo_tag_es:      "",
  why_photo_headline_es: "",
  why_photo_cta_es:      "",

  plans_heading: "Monthly Laundry Plans",
  plans_body:    "Subscribe and save. Flat monthly fee with included pounds, auto-billed overage, and priority scheduling — no thinking required.",
  plans_heading_es: "",
  plans_body_es:    "",

  // Testimonials — empty = falls back to translation string
  t1_quote: "", t1_name: "", t1_label: "",
  t2_quote: "", t2_name: "", t2_label: "",
  t3_quote: "", t3_name: "", t3_label: "",
  t1_quote_es: "", t1_name_es: "", t1_label_es: "",
  t2_quote_es: "", t2_name_es: "", t2_label_es: "",
  t3_quote_es: "", t3_name_es: "", t3_label_es: "",
}
