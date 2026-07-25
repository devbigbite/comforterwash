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

interface QuantityPriceable extends SalePriceable {
  pricing_unit?: "per_order" | "per_pound" | "per_item" | "per_load" | null
}

/**
 * Effective price for one option given the order's quantities.
 * - per_order (default): flat, charged once
 * - per_pound: price × pounds (falls back to 1 if pounds not provided)
 * - per_item: price × item quantity (e.g. number of comforters/pieces)
 * - per_load: price × number of bags/loads
 */
export function effectivePriceForOrder(
  opt: QuantityPriceable,
  qty: { pounds?: number; items?: number; loads?: number }
): number {
  const unitPrice = effectivePrice(opt)
  switch (opt.pricing_unit) {
    case "per_pound": return Math.round(unitPrice * Math.max(qty.pounds ?? 1, 0))
    case "per_item":  return Math.round(unitPrice * Math.max(qty.items ?? 1, 0))
    case "per_load":  return Math.round(unitPrice * Math.max(qty.loads ?? 1, 0))
    default:          return unitPrice
  }
}

// Customer-facing suffix appended to a price badge (e.g. "+$0.15/lb") so
// shoppers understand a detergent/extra/accessory rate is per pound, per
// item, or per load rather than a single flat add-on — previously the price
// badge never said which, which was confusing for anything not per-order.
export function unitSuffix(
  unit: "per_order" | "per_pound" | "per_item" | "per_load" | null | undefined,
  locale: "en" | "es" = "en"
): string {
  switch (unit) {
    case "per_pound": return locale === "es" ? "/libra" : "/lb"
    case "per_item":  return locale === "es" ? "/artículo" : "/item"
    case "per_load":  return locale === "es" ? "/carga" : "/load"
    default:          return ""
  }
}
