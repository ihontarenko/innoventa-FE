import type { FieldDetail, FormEntry } from "@/types"

/**
 * What a stored value reads as, when the value is an identifier.
 *
 * <h2>⚠️ A reference stored is an id, and printing it raw is the defect this exists to stop</h2>
 *
 * A field whose choices come from a source stores the chosen row's **identifier** — a position's part
 * field holds `UT9qbvRJmqFaaiSQ`, not `SS34 Schottky`. The backend resolves every one of them into
 * `optionLabels` on the response precisely so nothing has to fetch them again; a screen that reads
 * `fieldValues` and skips that map prints the identifier, and the record's own card ends up titled
 * with a string nobody can read.
 *
 * ⚠️ **Here rather than in one screen.** It was written once inside the inventory table, so the record
 * card — a different file — still printed raw ids while the list beside it read correctly. Two copies
 * of this rule is how one of them stays wrong.
 */

/**
 * A field's choices, with anything the server resolved merged over them.
 *
 * ⚠️ **Values the field has no option row for are appended, not dropped.** A source-backed field has no
 * static options at all, so its whole label set arrives this way — filtering to known values would
 * leave every one of them unlabelled.
 */
export function optionsWithLabels(field: FieldDetail, entry: FormEntry) {
  const resolved = entry.optionLabels?.[field.name]

  if (!resolved) {
    return field.options
  }

  const merged = field.options.map((option) => ({
    ...option,
    optionLabel: resolved[option.optionValue] ?? option.optionLabel,
  }))

  const known = new Set(merged.map((option) => option.optionValue))

  return [
    ...merged,
    ...Object.entries(resolved)
      .filter(([value]) => !known.has(value))
      .map(([optionValue, optionLabel]) => ({ optionValue, optionLabel })),
  ]
}

/**
 * What this field holds, as a person reads it — the resolved label where there is one.
 *
 * ⚠️ **Falls back to the stored value rather than to nothing.** An identifier whose row has been
 * deleted is evidence that something was chosen; printing it is worse than a name and far better than
 * a blank, which reads as *never filled in*.
 */
export function readableValueOf(entry: FormEntry, field: FieldDetail | undefined): string {
  if (!field) {
    return ""
  }

  const stored = entry.fieldValues[field.name] ?? ""

  return entry.optionLabels?.[field.name]?.[stored] ?? stored
}
