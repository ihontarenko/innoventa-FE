import type { ValueSpelling } from "@/api/parametric"

/**
 * The small helpers every feature shares.
 *
 * ⚠️ **What is *not* here matters as much as what is.** Under ADR-0009 a written value — `4k7`, `332`,
 * a colour band — is read by the **backend** and nowhere else, so there is no parser in this file and
 * there must not be one. What is here is arithmetic on numbers a widget already has, and the assembly of
 * the text a widget sends off to be read.
 */

export function parseNumber(raw: string | undefined): number | null {
  if (!raw?.trim()) {
    return null
  }

  const parsed = Number.parseFloat(raw.trim())

  return Number.isNaN(parsed) ? null : parsed
}

export function parsePositive(raw: string | undefined): number | null {
  const parsed = parseNumber(raw)

  return parsed !== null && parsed > 0 ? parsed : null
}

/** A composite field stores `value|unit`; this reads it back as one string to show. */
export function parsePipeDisplay(raw: string | undefined): string {
  if (!raw) {
    return "—"
  }

  const parts = raw.split("|")

  return parts.length >= 2 ? `${parts[0]}${parts[1]}` : raw
}

export const CAPACITANCE_UNIT_FACTORS: Record<string, number> = {
  pF: 1e-12,
  nF: 1e-9,
  "µF": 1e-6,
  mF: 1e-3,
  F: 1,
}

export const INDUCTANCE_UNIT_FACTORS: Record<string, number> = {
  "µH": 1e-6,
  mH: 1e-3,
  H: 1,
}

/**
 * Digits and a separator only — a magnitude that has not already said what it is.
 *
 * ⚠️ **A comma is passed through rather than stripped.** Whether `1,000` is a thousand or is one is the
 * interpreter's decision — it reads a decimal comma, the way the search field does — and a widget
 * quietly deleting the character to force the other reading is exactly the second opinion ADR-0009
 * exists to remove.
 */
const BARE_MAGNITUDE = /^[\d.,]+$/

/**
 * The written value a field holds, as one string the interpreter can read.
 *
 * ⚠️ **The unit is appended only to a bare magnitude.** `3.3k` already names a scale, and gluing `kΩ`
 * onto it yields `3.3kkΩ` — the same order-of-magnitude error the search endpoint refuses by keeping
 * magnitude and dimension apart. When the value speaks for itself it passes through untouched.
 */
export function writtenValueFrom(rawValue: string | undefined, rawUnit?: string): string {
  const value = (rawValue ?? "").trim()

  if (value === "") {
    return ""
  }

  const pipe = value.indexOf("|")

  if (pipe >= 0) {
    return joinMagnitudeAndUnit(value.slice(0, pipe).trim(), value.slice(pipe + 1).trim())
  }

  return joinMagnitudeAndUnit(value, (rawUnit ?? "").trim())
}

function joinMagnitudeAndUnit(magnitude: string, unit: string): string {
  if (unit === "" || !BARE_MAGNITUDE.test(magnitude)) {
    return magnitude
  }

  return `${magnitude}${unit}`
}

/**
 * The text of one spelling, or `null` when the value cannot be written that way at all.
 *
 * ⚠️ **`NOT_EXPRESSIBLE` flattens to `null` deliberately.** A picture of a chip has one place to put a
 * marking and no place to put a reason; a blank chip is the honest drawing, and the reason belongs on a
 * screen that has room for prose — which is what `ValueReadings` is.
 */
export function spellingTextFor(
  reading: { spellings: ValueSpelling[] } | undefined,
  family: string,
): string | null {
  const spelling = reading?.spellings.find((candidate) => candidate.family === family)

  return !spelling || spelling.state === "NOT_EXPRESSIBLE" ? null : spelling.text
}
