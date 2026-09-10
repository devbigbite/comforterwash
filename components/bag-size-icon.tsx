"use client"

/**
 * Small visual size reference for a bag-size option. Renders a simple bag
 * glyph that scales with the bag's rank among the other enabled sizes
 * (smallest -> smallest icon, largest -> largest icon), so customers get a
 * relative size cue even before reading the label/description.
 */
export function BagSizeIcon({ rank, total, className }: { rank: number; total: number; className?: string }) {
  // rank is 0-indexed position from smallest to largest among enabled sizes.
  const frac = total > 1 ? rank / (total - 1) : 0.5
  const size = Math.round(22 + frac * 20) // 22px (smallest) -> 42px (largest)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <path
        d="M7 8.5V6.5C7 4.01 9.01 2 11.5 2h1c2.49 0 4.5 2.01 4.5 4.5v2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M5.5 8.5h13l1 12.2c.06.72-.5 1.3-1.22 1.3H5.72c-.72 0-1.28-.58-1.22-1.3l1-12.2Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}
