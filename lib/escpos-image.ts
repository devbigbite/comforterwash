"use client"

/**
 * Converts a logo image (public/receipt-logo.png) into raw ESC/POS raster
 * bit-image bytes so the operator bag-receipts printer can print the actual
 * WashFold Orlando logo at the top of each receipt instead of plain text.
 *
 * Runs entirely client-side (a browser <canvas>, not a server action) —
 * the printer connection itself is Web Serial/Bluetooth from the browser,
 * so the rasterized bytes need to be built there too. Result is cached in
 * memory per page load since the logo never changes mid-session.
 *
 * Uses a plain luminance threshold (no dithering) — good enough for a
 * solid-shape logo like this one, and keeps the printed data simple/fast
 * for the printer's ESC/POS raster command:
 *   GS v 0 m xL xH yL yH d1..dk   (m=0 normal, k = widthBytes * heightPx)
 */

const GS = 0x1d

let cached: Uint8Array | null = null
let inFlight: Promise<Uint8Array | null> | null = null

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Failed to load logo image"))
    img.src = src
  })
}

/**
 * @param url logo image URL (same-origin, e.g. "/receipt-logo.png")
 * @param targetWidthPx print width in dots — kept modest (well under any
 *   80mm printer's ~576-dot line width) so the logo prints quickly and
 *   never risks overflowing a narrower unit's printable area.
 */
export async function getLogoRasterBytes(
  url = "/receipt-logo-v2.jpg",
  targetWidthPx = 320
): Promise<Uint8Array | null> {
  if (cached) return cached
  if (inFlight) return inFlight

  inFlight = (async () => {
    try {
      const img = await loadImage(url)
      const scale = targetWidthPx / img.width
      const targetHeightPx = Math.max(1, Math.round(img.height * scale))

      const canvas = document.createElement("canvas")
      canvas.width = targetWidthPx
      canvas.height = targetHeightPx
      const ctx = canvas.getContext("2d")
      if (!ctx) return null

      // White backdrop first — the logo has no transparent areas, but this
      // guards against any edge antialiasing reading as mid-gray.
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, targetWidthPx, targetHeightPx)
      ctx.drawImage(img, 0, 0, targetWidthPx, targetHeightPx)

      const { data } = ctx.getImageData(0, 0, targetWidthPx, targetHeightPx)
      const widthBytes = Math.ceil(targetWidthPx / 8)
      const raster = new Uint8Array(widthBytes * targetHeightPx)

      for (let y = 0; y < targetHeightPx; y++) {
        for (let x = 0; x < targetWidthPx; x++) {
          const i = (y * targetWidthPx + x) * 4
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b
          const isDark = a > 10 && luminance < 160
          if (isDark) {
            const byteIndex = y * widthBytes + (x >> 3)
            raster[byteIndex] |= 0x80 >> (x & 7)
          }
        }
      }

      const header = new Uint8Array([
        GS, 0x76, 0x30, 0x00,
        widthBytes & 0xff, (widthBytes >> 8) & 0xff,
        targetHeightPx & 0xff, (targetHeightPx >> 8) & 0xff,
      ])
      const out = new Uint8Array(header.length + raster.length)
      out.set(header, 0)
      out.set(raster, header.length)
      cached = out
      return out
    } catch (err) {
      console.error("[escpos-image] Failed to build logo raster:", err)
      return null
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}
