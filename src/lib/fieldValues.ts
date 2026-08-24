import type { FieldOption } from "@/types"

/**
 * Turning a stored field value into the string a person reads.
 *
 * ⚠️ **One place, and it has to stay one place.** Every value renderer, every table cell and every
 * search result goes through here — which is what stops a composite like `22|pF` leaking its pipe onto
 * a screen. A second copy of this switch is how one screen starts showing `22|pF` while its neighbour
 * shows `22 pF`.
 */

export interface NormalizableField {
  elementType?: string
  unit?: string | null
  options?: Array<Pick<FieldOption, "optionValue" | "optionLabel">>
}

/** A field's unit can be a comma-separated list of choices — the first is the default. */
function firstUnit(unit?: string | null): string {
  return unit ? unit.split(",")[0].trim() : ""
}

/**
 * Handles composites (`22|pF` → `22 pF`), ranges (`1|5` → `1…5`), choices (value → label), booleans
 * and unit-bearing numbers. ⚠️ Rich media — an image, a file, a link — is rendered by the value
 * components rather than here: this produces **text only**, and returning markup from a formatter is
 * how an alt attribute ends up with a `<span>` in it.
 */
export function normalizeValueForUI(value: string | null | undefined, field?: NormalizableField): string {
  if (value === null || value === undefined || value === "") {
    return ""
  }

  const type = field?.elementType ?? ""
  const options = field?.options
  const optionLabel = (raw: string) => options?.find((option) => option.optionValue === raw)?.optionLabel ?? raw

  // ⚠️ The `type === ""` arm is not defensive noise: a value can arrive without its field — a search
  // result carrying only what matched — and a pipe in it is a composite whatever nobody told us.
  if (type === "SIMPLE_COMPOSITE" || (type === "" && value.includes("|"))) {
    const [number, valueUnit] = value.split("|", 2)
    const unit = (valueUnit && valueUnit.trim()) || firstUnit(field?.unit) || (options?.[0]?.optionLabel ?? "")

    return unit ? `${number} ${unit}` : number
  }

  if (type === "RANGE") {
    const [minimum, maximum] = value.split("|", 2)

    return maximum ? `${minimum}…${maximum}` : minimum
  }

  if (type === "SELECT" || type === "RADIO") {
    return optionLabel(value)
  }

  if (type === "MULTISELECT" || type === "CHECKBOXES" || type === "TAGS") {
    const parts = value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)

    // ⚠️ Tags are their own labels — they have no option rows to look up, and running them through
    // `optionLabel` would be a lookup that always misses and always returns the input.
    return (type === "TAGS" ? parts : parts.map(optionLabel)).join(", ")
  }

  if (type === "CHECKBOX" || type === "TOGGLE" || value === "true" || value === "false") {
    return value === "true" ? "Yes" : "No"
  }

  if (type === "NUMBER") {
    const unit = firstUnit(field?.unit)

    return unit ? `${value} ${unit}` : value
  }

  return value
}
