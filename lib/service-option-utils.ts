// Minimal type — avoids importing from a "use server" file
interface SalePriceable {
  price_cents: number
  sale_price_cents?: number | null
  sale_ends_at?: string | null
}

/** Returns the active price — sale price if set and not expired, otherwise regular price */
export function effectivePrice(opt: SalePriceable): number {
  if (
    opt.sale_price_cents != null &&
    (!opt.sale_ends_at || new Date(opt.sale_ends_at) > new Date())
  ) {
    return opt.sale_price_cents
  }
  return opt.price_cents
}

/** True if a sale is currently active */
export function isSaleActive(opt: SalePriceable): boolean {
  return (
    opt.sale_price_cents != null &&
    (!opt.sale_ends_at || new Date(opt.sale_ends_at) > new Date())
  )
}
