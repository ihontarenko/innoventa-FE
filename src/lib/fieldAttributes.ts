import type { CSSProperties } from "react"

/**
 * A field's `attributes` map is two things at once: HTML attributes to forward to the input, and a few
 * keys the renderer itself reads. Telling them apart is this module's whole job.
 */

/**
 * ⚠️ **Keys that mean something to the renderer and must never reach the DOM.** React would pass an
 * unknown attribute straight through, so `checkboxLabel="Agreed"` becomes a stray attribute on an
 * `<input>` — invalid HTML, and a warning in every console.
 */
const SEMANTIC_FIELD_ATTRIBUTES = new Set(["checkboxLabel", "labelOn", "labelOff"])

function parseCssString(css: string): CSSProperties {
  const style: Record<string, string> = {}

  for (const declaration of css.split(";")) {
    const colonIndex = declaration.indexOf(":")

    if (colonIndex === -1) {
      continue
    }

    const property = declaration.slice(0, colonIndex).trim()
    const value = declaration.slice(colonIndex + 1).trim()

    if (!property || !value) {
      continue
    }

    // `font-weight` is a CSS property; React wants `fontWeight`.
    style[property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())] = value
  }

  return style as CSSProperties
}

/**
 * The attributes safe to spread onto a native input, with `style` turned into the object React expects.
 *
 * @param exclude keys the caller renders itself — `placeholder` where it composes one from the
 *                description, `step` where it has its own default.
 */
export function htmlAttributesOf(
  attributes: Record<string, string>,
  ...exclude: string[]
): Record<string, unknown> {
  const skip = new Set([...SEMANTIC_FIELD_ATTRIBUTES, ...exclude])
  const forwarded: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(attributes)) {
    if (skip.has(key)) {
      continue
    }

    forwarded[key] = key === "style" ? parseCssString(value) : value
  }

  return forwarded
}
