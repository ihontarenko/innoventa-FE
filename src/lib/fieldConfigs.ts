import type { FieldDetail } from "@/types"

/**
 * The configuration keys the runtime reads, named once.
 *
 * ⚠️ **The old interface has a `FieldConfigs` class with thirty getters** covering image processing,
 * inventory behaviour and more. It is not ported wholesale: a key arrives here with the screen that
 * reads it, so this file stays a list of what is actually used rather than a catalogue of what exists.
 */
export const FIELD_CONFIG_KEYS = {
  /** The line under a control — what to type, in the form author's words. */
  DISPLAY_HINT: "display.hint",
} as const

/**
 * The help line under a field: the author's configured hint first, then the field's own description.
 *
 * ⚠️ A configured hint wins because it was written *for the person filling the form*, while a
 * description is often written for whoever maintains the schema.
 */
export function displayHintOf(field: FieldDetail): string | null {
  return field.configs[FIELD_CONFIG_KEYS.DISPLAY_HINT] || field.description || null
}
