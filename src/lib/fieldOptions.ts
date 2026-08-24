import type { FieldDetail, FieldSummary } from "@/types"

/**
 * Where a field's choices come from, and how they are written down.
 *
 * ⚠️ **`value:Label`, comma-separated, and a bare item is its own label.** That shape is stored in
 * configuration and typed by hand, so it has to survive sloppiness: extra spaces, a trailing comma, a
 * label containing a colon (only the first one splits).
 */

export interface ChoiceOption {
  value: string
  label: string
}

/** Which configuration key names the provider, and where its parameters live. */
export const OPTION_SOURCE_KEYS = {
  /** Which provider draws the choices. */
  SOURCE: "options.source",
  /** Everything under this prefix is one of that provider's own parameters. */
  PARAMETER_PREFIX: "options.source.",
} as const

/** The provider a field with no configuration resolves through. */
export const STATIC_OPTION_SOURCE = "static"

/** Configuration key holding hand-typed choices, for a field whose rows are empty. */
const STATIC_OPTIONS_KEY = "options"

export function parseOptions(raw: string): ChoiceOption[] {
  return raw
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((item) => {
      const colonIndex = item.indexOf(":")

      if (colonIndex === -1) {
        return { value: item, label: item }
      }

      return { value: item.slice(0, colonIndex).trim(), label: item.slice(colonIndex + 1).trim() }
    })
}

export function serializeOptions(options: ChoiceOption[]): string {
  return options
    .map((option) => (option.label && option.label !== option.value ? `${option.value}:${option.label}` : option.value))
    .join(", ")
}

/**
 * The choices to draw for a field.
 *
 * ⚠️ **Rows first, configuration second.** A field's `options` rows are the real thing; the
 * `options` configuration key is the older hand-typed spelling that some fields still carry. Reading
 * rows first means a field that has been given proper rows is never drawn from a stale string beside
 * them.
 */
export function optionsOf(field: FieldDetail | FieldSummary): ChoiceOption[] {
  if (field.options.length > 0) {
    return field.options.map((option) => ({ value: option.optionValue, label: option.optionLabel }))
  }

  const configs = (field as FieldDetail).configs

  return configs?.[STATIC_OPTIONS_KEY] ? parseOptions(configs[STATIC_OPTIONS_KEY]) : []
}

/**
 * Which provider draws this field's choices.
 *
 * ⚠️ **Absent means `static`** — that is every field that existed before sources did, and every widget
 * renders exactly as it always has for those.
 */
export function optionSourceOf(field: FieldDetail): string {
  return field.configs[OPTION_SOURCE_KEYS.SOURCE] || STATIC_OPTION_SOURCE
}

/**
 * The unit choices of a composite: its option rows if it has them, otherwise its own comma-separated
 * `unit` string. ⚠️ A composite with neither has no unit picker at all rather than an empty one.
 */
export function unitOptionsOf(field: FieldDetail): ChoiceOption[] {
  if (field.options.length > 0) {
    return field.options.map((option) => ({ value: option.optionValue, label: option.optionLabel }))
  }

  if (!field.unit) {
    return []
  }

  return field.unit
    .split(",")
    .map((unit) => unit.trim())
    .filter(Boolean)
    .map((unit) => ({ value: unit, label: unit }))
}
