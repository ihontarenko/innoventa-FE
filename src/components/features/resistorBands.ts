/**
 * The colour table, and the two things that read it.
 *
 * ⚠️ **What is deliberately *not* here: the SMD tables, the encoders, the decoders, and any parser for
 * written resistance.** Turning text into a value, and a value into an industry code, are *answers* —
 * and answers come from `GET /api/parametric/readings` under ADR-0009. Digit to colour is a **picture**,
 * and pictures stay where the pixels are. A widget that re-derived `4k7` in the browser is exactly how
 * one comes to disagree with the search about what it is worth.
 *
 * ⚠️ **The hexes are literal and stay literal.** A resistor's bands are brown, red, orange in the world;
 * theming them would be drawing a different component.
 */
export interface BandColor {
  name: string
  hex: string
  digit: number | null
  multiplier: number | null
  tolerance: string | null
}

export const BAND_COLORS: BandColor[] = [
  { name: "Black", hex: "#1A1A1A", digit: 0, multiplier: 1, tolerance: null },
  { name: "Brown", hex: "#795548", digit: 1, multiplier: 10, tolerance: "±1%" },
  { name: "Red", hex: "#C62828", digit: 2, multiplier: 100, tolerance: "±2%" },
  { name: "Orange", hex: "#E64A19", digit: 3, multiplier: 1_000, tolerance: null },
  { name: "Yellow", hex: "#F9A825", digit: 4, multiplier: 10_000, tolerance: null },
  { name: "Green", hex: "#388E3C", digit: 5, multiplier: 100_000, tolerance: "±0.5%" },
  { name: "Blue", hex: "#1565C0", digit: 6, multiplier: 1_000_000, tolerance: "±0.25%" },
  { name: "Violet", hex: "#6A1B9A", digit: 7, multiplier: null, tolerance: "±0.1%" },
  { name: "Gray", hex: "#757575", digit: 8, multiplier: null, tolerance: "±0.05%" },
  { name: "White", hex: "#E0E0E0", digit: 9, multiplier: null, tolerance: null },
  { name: "Gold", hex: "#D4AF37", digit: null, multiplier: 0.1, tolerance: "±5%" },
  { name: "Silver", hex: "#AAAAAA", digit: null, multiplier: 0.01, tolerance: "±10%" },
]

export interface DecodedBands {
  band1: BandColor
  band2: BandColor
  band3: BandColor
  digit1: number
  digit2: number
}

/**
 * A resistance in ohms as the three bands that draw it.
 *
 * ⚠️ **Normalised into two significant digits and a decade, which is what a four-band resistor *is*.**
 * A value that needs three digits cannot be drawn on four bands at all, and rounding it here is the
 * honest drawing rather than a refusal — the readout beside the picture carries the exact figure.
 */
export function decode4Band(ohms: number): DecodedBands | null {
  if (ohms <= 0 || !Number.isFinite(ohms)) {
    return null
  }

  let multiplier = 1
  let significand = ohms

  while (significand >= 100) {
    significand /= 10
    multiplier *= 10
  }

  while (significand < 10 && multiplier > 0.01) {
    significand *= 10
    multiplier /= 10
  }

  const digit1 = Math.floor(significand / 10)
  const digit2 = Math.round(significand % 10)

  const band1 = BAND_COLORS.find((color) => color.digit === digit1)
  const band2 = BAND_COLORS.find((color) => color.digit === digit2)
  // ⚠️ Gold when no band carries this decade — a multiplier below ×0.01 has no colour, and a picture
  // with a missing band is worse than one with the nearest.
  const band3 =
    BAND_COLORS.find((color) => color.multiplier === multiplier) ??
    BAND_COLORS.find((color) => color.name === "Gold")!

  if (!band1 || !band2) {
    return null
  }

  return { band1, band2, band3, digit1, digit2 }
}

/** ⚠️ ±5 % (gold) when nothing is said — it is what an unmarked resistor is sold at. */
export function parseTolerance(raw: string | null | undefined): { percentage: number; color: BandColor } {
  const gold = BAND_COLORS.find((color) => color.name === "Gold")!
  const digits = raw?.match(/[\d.]+/)

  if (!digits) {
    return { percentage: 5, color: gold }
  }

  const percentage = Number.parseFloat(digits[0])

  const BY_PERCENTAGE: Array<[number, string]> = [
    [0.05, "Gray"],
    [0.1, "Violet"],
    [0.25, "Blue"],
    [0.5, "Green"],
    [1, "Brown"],
    [2, "Red"],
    [5, "Gold"],
    [10, "Silver"],
  ]

  for (const [threshold, name] of BY_PERCENTAGE) {
    if (Math.abs(percentage - threshold) < 0.001) {
      return { percentage, color: BAND_COLORS.find((color) => color.name === name)! }
    }
  }

  return { percentage, color: gold }
}
