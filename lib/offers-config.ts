export interface LandingOffer {
  enabled: boolean
  badge: string
  title: string
  desc: string
}

export const DEFAULT_OFFERS: LandingOffer[] = [
  {
    enabled: true,
    badge: "15% OFF",
    title: "15% Off Your First Order",
    desc: "New to WashFold? Try us out and save big while experiencing the joy of laundry freedom. (Discount applied automatically)",
  },
  {
    enabled: true,
    badge: "FREE",
    title: "Free Premium Laundry Bag",
    desc: "We'll deliver your first order in a custom WashFold Orlando bag — yours to keep!",
  },
  {
    enabled: true,
    badge: "ALWAYS",
    title: "Always Free Pickup & Delivery",
    desc: "No gimmicks. No hidden fees. Just clean laundry, delivered free to your door every time.",
  },
]
