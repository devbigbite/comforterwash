export interface SiteImageSlot {
  key: string
  label: string
  description: string
  fallback: string
}

export const SITE_IMAGE_SLOTS: SiteImageSlot[] = [
  {
    key: "hero_banner",
    label: "Hero Banner",
    description: "Main carousel background — all 3 slides",
    fallback: "/hero-banner.jpg",
  },
  {
    key: "why_us",
    label: "Why Choose Us",
    description: "Lifestyle photo in the 'Why Choose Us' section",
    fallback: "/img-why-us.jpg",
  },
  {
    key: "offers_bg",
    label: "Offers Background",
    description: "Background image behind the Special Offers cards",
    fallback: "/img-offers.jpg",
  },
]

export interface SiteImages {
  hero_banner: string
  why_us: string
  offers_bg: string
}

export const DEFAULT_IMAGES: SiteImages = {
  hero_banner: "/hero-banner.jpg",
  why_us: "/img-why-us.jpg",
  offers_bg: "/img-offers.jpg",
}
