export interface SiteImageSlot {
  key: string
  label: string
  description: string
  fallback: string
}

export const SITE_IMAGE_SLOTS: SiteImageSlot[] = [
  {
    key: "slide_1",
    label: "Banner — Slide 1",
    description: "Background for the first hero slide (full-width text)",
    fallback: "/hero-banner.jpg",
  },
  {
    key: "slide_2",
    label: "Banner — Slide 2 (Steps)",
    description: "Panoramic photo for the Order / Pick Up / Deliver slide",
    fallback: "/hero-banner.jpg",
  },
  {
    key: "slide_3",
    label: "Banner — Slide 3",
    description: "Background for the third hero slide (full-width text)",
    fallback: "/hero-banner.jpg",
  },
  {
    key: "why_us",
    label: "Why Choose Us",
    description: "Rectangular lifestyle photo in the Why Choose Us section",
    fallback: "/img-why-us.jpg",
  },
  {
    key: "offer_1",
    label: "Offer Card 1",
    description: "Background image for the first offer card",
    fallback: "/img-offers.jpg",
  },
  {
    key: "offer_2",
    label: "Offer Card 2",
    description: "Background image for the second offer card",
    fallback: "/img-offers.jpg",
  },
  {
    key: "offer_3",
    label: "Offer Card 3",
    description: "Background image for the third offer card",
    fallback: "/img-offers.jpg",
  },
]

export interface SiteImages {
  slide_1: string
  slide_2: string
  slide_3: string
  why_us: string
  offer_1: string
  offer_2: string
  offer_3: string
}

export const DEFAULT_IMAGES: SiteImages = {
  slide_1: "/hero-banner.jpg",
  slide_2: "/hero-banner.jpg",
  slide_3: "/hero-banner.jpg",
  why_us: "/img-why-us.jpg",
  offer_1: "/img-offers.jpg",
  offer_2: "/img-offers.jpg",
  offer_3: "/img-offers.jpg",
}
