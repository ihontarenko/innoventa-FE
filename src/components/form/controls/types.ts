import type { FieldDetail } from "@/types"

/**
 * What every control in this folder is handed, and nothing more.
 *
 * ⚠️ **A control renders the input and nothing around it** — no label, no help text, no error message.
 * `DynamicForm` draws those, and so does a jMouse-EL live block, which is why a control that drew its
 * own label would look right in one place and wrong in the other.
 *
 * ⚠️ **The value is always a string.** Composites are `a|b`, multi-values are comma-joined, booleans
 * are `"true"`. That is the contract with the backend and it is not this layer's to reinterpret.
 */
export interface ControlProperties {
  field: FieldDetail
  value: string
  onChange: (value: string) => void
  /** Whether to paint the error state. The message itself belongs to the caller. */
  hasError?: boolean
  /** The entry being filled, so a field whose choices come from an expression can read its neighbours. */
  draftValues?: Record<string, string>
  /** What this field's stored values read as, where the server already resolved them. */
  optionLabels?: Record<string, string>
}

/** A multi-value field's current selection, from its comma-joined string. */
export function selectedValuesOf(value: string): string[] {
  return value ? value.split(",").map((segment) => segment.trim()) : []
}

/** Add or remove one value from a comma-joined selection, preserving the order it was chosen in. */
export function toggleValue(value: string, optionValue: string): string {
  const selected = selectedValuesOf(value)

  return (
    selected.includes(optionValue) ? selected.filter((candidate) => candidate !== optionValue) : [...selected, optionValue]
  ).join(",")
}
