/**
 * Shared delivery fee + tip utilities used by all 3 booking forms.
 * Keep this file free of React imports — pure TS only.
 */

export type TipOption = "none" | "10" | "15" | "20" | "custom"

export interface FeeSettings {
  deliveryEnabled: boolean
  deliveryFeeCents: number
  waiverCents: number   // 0 = always charge
}

/** Returns the delivery fee cents to apply given the order subtotal */
export function calcDeliveryFee(settings: FeeSettings, subtotalCents: number): number {
  if (!settings.deliveryEnabled) return 0
  if (settings.waiverCents > 0 && subtotalCents >= settings.waiverCents) return 0
  return settings.deliveryFeeCents
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
