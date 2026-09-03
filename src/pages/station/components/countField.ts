import { FORM_CONFIG_KEYS } from "@/lib/formConfigs"
import type { FieldDetail } from "@/types/forms"

/**
 * Which field of a component type holds the count, and which holds its photograph.
 *
 * <h2>⚠️ It follows the convention the form model already has, rather than inventing one</h2>
 *
 * <p>A component type is a form, and a form's {@code config} already names which of its fields plays
 * which part — {@code primaryField} is the title an entry is listed under, {@code imageField} is the
 * picture beside it. That is exactly the shape the question "which field is the count" needs, so the
 * answer is {@code config.quantityField} and not a new mechanism.
 *
 * <p>It costs no migration: {@code config} is an open map, so a form can start carrying the key before
 * anything writes it, and the moment a form builder offers the setting this becomes right everywhere.
 *
 * <h2>The three questions, weakest last</h2>
 *
 * <ol>
 *   <li><strong>The form said so</strong> — {@code config.quantityField} names a field.
 *   <li><strong>There is only one number.</strong> A component type with exactly one active
 *       {@code NUMBER} field has no ambiguity to resolve.
 *   <li><strong>The person chose</strong>, remembered per form, because the answer is a property of
 *       that form and does not change between visits.
 * </ol>
 *
 * <p>⚠️ <strong>Where all three come up empty, the station shows the entry and offers no counter.</strong>
 * Taking the first numeric field would be a fourth guess and the one that silently edits the wrong
 * column — a component whose "count" turns out to have been its voltage rating is worse than a station
 * that admits it does not know which field to touch.
 *
 * <p>⚠️ <strong>Values are keyed by field NAME, not by id.</strong> That is the entry model's own
 * convention ({@code entry.fieldValues[field.name]}), and getting it backwards produces an entry that
 * saves without error and reads back empty.
 */

/**
 * The `config` keys a form uses to say what its fields mean — **the installation's own vocabulary**.
 *
 * <h2>⚠️ These were invented here, matched nothing, and failed as something plausible</h2>
 *
 * <p>They read `"primaryField"`, `"imageField"` and `"quantityField"`. What a form actually stores is
 * `display.primary_field`, `display.image_field` and `stock.quantity_field` — so every lookup missed,
 * every getter fell through to its fallback, and the station titled each row with *the form's first
 * field*. On the inventory form that is the component type, so a drawer of forty different parts
 * listed as `Resistor · Resistor · Resistor`. Nothing errored: a fallback firing looks exactly like a
 * form that declared nothing.
 *
 * <p>⚠️ **So they are re-exported from `FORM_CONFIG_KEYS` rather than restated.** A key named in two
 * places is a key that drifts, and this is what the drift looks like — not a crash, a screen quietly
 * answering a different question.
 */
export const QUANTITY_FIELD_CONFIG_KEY = FORM_CONFIG_KEYS.STOCK_QUANTITY_FIELD
export const IMAGE_FIELD_CONFIG_KEY = FORM_CONFIG_KEYS.IMAGE_FIELD
export const PRIMARY_FIELD_CONFIG_KEY = FORM_CONFIG_KEYS.PRIMARY_FIELD

/** Where a person's choice is remembered. Per form, because that is what the question is about. */
const CHOICE_STORAGE_PREFIX = "innoventa.station.components.count-field."

export type CountFieldSource = "declared" | "only-number" | "only-required-number" | "chosen" | "unknown"

export interface CountFieldResolution {
  field: FieldDetail | null
  source: CountFieldSource
  /** Every field a counter could sensibly act on — what a picker offers. */
  candidates: FieldDetail[]
}

function activeNumericFields(fields: readonly FieldDetail[]): FieldDetail[] {
  return fields.filter((field) => field.elementType === "NUMBER" && field.status === "ACTIVE")
}

/**
 * ⚠️ Wrapped because web storage throws outright in some contexts rather than answering empty — a
 * private window, or a browser told to block site data. A remembered preference is a convenience, and
 * a convenience must never be able to take a screen down.
 */
function readChoice(formId: string): string | null {
  try {
    return window.localStorage.getItem(`${CHOICE_STORAGE_PREFIX}${formId}`)
  } catch {
    return null
  }
}

export function rememberCountField(formId: string, fieldName: string): void {
  try {
    window.localStorage.setItem(`${CHOICE_STORAGE_PREFIX}${formId}`, fieldName)
  } catch {
    // A preference that cannot be stored is one asked for again next time, which is fine.
  }
}

export function resolveCountField(
  formId: string,
  fields: readonly FieldDetail[],
  config: Readonly<Record<string, string>>,
): CountFieldResolution {
  const candidates = activeNumericFields(fields)
  const declaredName = config[QUANTITY_FIELD_CONFIG_KEY]
  const declared = declaredName ? candidates.find((field) => field.name === declaredName) : undefined

  if (declared) {
    return { field: declared, source: "declared", candidates }
  }

  if (candidates.length === 1) {
    return { field: candidates[0]!, source: "only-number", candidates }
  }

  /**
   * ⚠️ **The only REQUIRED number, where there is exactly one.**
   *
   * <p>This is not a fourth guess dressed up — it is a fact the form states. A component type that
   * insists on a number before it will accept an entry at all is insisting on the count: nobody makes
   * a minimum-stock threshold or a temperature coefficient mandatory. `resistor` is the worked example
   * — three numeric fields, and only `quantity` is required.
   *
   * <p>It sits below the two above and above nothing, so a form that declares `quantityField` still
   * wins and a form with two required numbers still gets asked rather than guessed at.
   */
  const requiredNumbers = candidates.filter((field) => field.required)

  if (requiredNumbers.length === 1) {
    return { field: requiredNumbers[0]!, source: "only-required-number", candidates }
  }

  const chosenName = readChoice(formId)
  const chosen = chosenName ? candidates.find((field) => field.name === chosenName) : undefined

  if (chosen) {
    return { field: chosen, source: "chosen", candidates }
  }

  return { field: null, source: "unknown", candidates }
}

/** The field a component's photograph lives in, as the form declares it. */
export function imageFieldOf(
  fields: readonly FieldDetail[],
  config: Readonly<Record<string, string>>,
): FieldDetail | null {
  const name = config[IMAGE_FIELD_CONFIG_KEY]

  return (name ? fields.find((field) => field.name === name) : undefined) ?? null
}

/** What an entry is listed under — the form's own choice, or its first field. */
export function primaryFieldOf(
  fields: readonly FieldDetail[],
  config: Readonly<Record<string, string>>,
): FieldDetail | null {
  const name = config[PRIMARY_FIELD_CONFIG_KEY]

  return (name ? fields.find((field) => field.name === name) : undefined) ?? fields[0] ?? null
}

/**
 * The new value after an adjustment, or null where the current one is not a number.
 *
 * ⚠️ **A delta, never a replacement.** `subtract 3` composes with somebody else's `subtract 2`;
 * `set to 41` silently discards it. That matters here rather than in the arithmetic, because the same
 * intent is what the offline queue replays — see ADR 23.
 */
export function applyDelta(currentValue: string | undefined, delta: number): string | null {
  const current = Number(currentValue ?? "")

  if (!Number.isFinite(current)) {
    return null
  }

  // Counts do not go negative, and a station that let one is a station that made a stocktake lie.
  return String(Math.max(0, current + delta))
}
