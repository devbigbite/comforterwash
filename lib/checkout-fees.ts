/**
 * Shared delivery fee + tip utilities used by all 3 booking forms.
 * Keep this file free of React imports — pure TS only.
 */

export type TipOption = "none" | "10" | "15" | "20" | "custom"

/** Per-service flat delivery fees — no waiver logic */
export interface DeliveryFeeConfig {
  comforterCents: number   // fee for comforter wash
  washFoldCents:  number   // fee for wash & fold
  washOnlyCents:  number   // fee for wash only
}

/** Returns the delivery fee cents for a given service type */
export function calcDeliveryFee(
  config: DeliveryFeeConfig,
  service: "comforter_wash" | "wash_fold" | "wash_only"
): number {
  if (service === "comforter_wash") return Math.max(0, config.comforterCents)
  if (service === "wash_fold")      return Math.max(0, config.washFoldCents)
  return Math.max(0, config.washOnlyCents)
}

/** Returns tip cents given an option selection and the base subtotal */
export function calcTip(option: TipOption, customCents: number, baseCents: number): number {
  if (option === "none") return 0
  if (option === "custom") return Math.max(0, customCents)
  return Math.round(baseCents * parseInt(option) / 100)
}

export const TIP_PRESETS: { label: string; value: TipOption }[] = [
  { label: "No tip", value: "none" },
  { label: "10%",    value: "10"  },
  { label: "15%",    value: "15"  },
  { label: "20%",    value: "20"  },
  { label: "Custom", value: "custom" },
]

// ── Legacy shim — kept so any code that still imports FeeSettings compiles ───
/** @deprecated Use DeliveryFeeConfig + calcDeliveryFee(config, service) */
export interface FeeSettings {
  deliveryEnabled: boolean
  deliveryFeeCents: number
  waiverCents: number
}
