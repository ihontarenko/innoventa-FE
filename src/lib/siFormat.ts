const SI_PREFIXES: ReadonlyArray<{ prefix: string; factor: number }> = [
  { prefix: "T", factor: 1e12 },
  { prefix: "G", factor: 1e9 },
  { prefix: "M", factor: 1e6 },
  { prefix: "k", factor: 1e3 },
  { prefix: "", factor: 1 },
  { prefix: "m", factor: 1e-3 },
  { prefix: "μ", factor: 1e-6 },
  { prefix: "n", factor: 1e-9 },
  { prefix: "p", factor: 1e-12 },
]

/**
 * A number with the SI prefix that suits its size.
 *
 * ⚠️ **A fallback, not the authority.** What a *stored* value reads as comes from the backend's
 * interpreter (ADR-0009) — this is for numbers a widget has computed itself, where there is nothing to
 * interpret and a round trip would be absurd.
 *
 * ```
 * formatSI(100_000, "W") → "100kW"
 * formatSI(4_700,   "Ω") → "4.7kΩ"
 * formatSI(0.02,    "A") → "20mA"
 * formatSI(null,    "V") → "—"
 * ```
 */
export function formatSI(value: number | null, unit: string, precision = 3): string {
  if (value === null) {
    return "—"
  }

  if (value === 0) {
    return `0${unit}`
  }

  const magnitude = Math.abs(value)
  const sign = value < 0 ? "-" : ""
  const entry = SI_PREFIXES.find(({ factor }) => magnitude >= factor) ?? SI_PREFIXES[SI_PREFIXES.length - 1]
  const scaled = Number.parseFloat((magnitude / entry.factor).toPrecision(precision))

  return `${sign}${scaled}${entry.prefix}${unit}`
}
