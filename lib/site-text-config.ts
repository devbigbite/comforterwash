/**
 * Default text values for the hero carousel slides.
 * Keys map to `settings` table rows prefixed with `txt_`.
 */

export interface SiteText {
  // Slide 1
  slide_1_headline: string
  slide_1_subline: string
  slide_1_cta: string
  // Slide 2 — step panels
  slide_2_p1_label: string
  slide_2_p1_desc: string
  slide_2_p2_label: string
  slide_2_p2_desc: string
  slide_2_p3_label: string
  slide_2_p3_desc: string
  // Slide 3
  slide_3_headline: string
  slide_3_subline: string
  slide_3_cta: string
}

export const DEFAULT_TEXT: SiteText = {
  slide_1_headline: "Laundry Service That Feels Like Family",
  slide_1_subline:  "Free pickup & delivery · Wash, fold & comforter cleaning · Orlando FL",
  slide_1_cta:      "Schedule a Pickup",

  slide_2_p1_label: "ORDER",
  slide_2_p1_desc:  "Schedule your pickup in seconds",
  slide_2_p2_label: "WE PICK UP",
  slide_2_p2_desc:  "We pick up your laundry right from your door",
  slide_2_p3_label: "WE DELIVER",
  slide_2_p3_desc:  "Fresh, clean & folded delivered to you",

  slide_3_headline: "We Come to You. You Enjoy Life.",
  slide_3_subline:  "Professional wash & fold starting at $2.40/lb · Comforters from $35",
  slide_3_cta:      "See Pricing",
}
