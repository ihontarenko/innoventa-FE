import type { FieldCondition, FieldDetail, FormDetail } from "@/types"

/**
 * The rules a form runs on: which fields show, which are required, and what a virtual field's hidden
 * child already knows.
 *
 * ⚠️ **Pure functions, deliberately kept out of the components.** This is where a mistake is silent —
 * a field that quietly stops showing, or one that stops being required — and logic living inside a
 * renderer can only be checked by looking at a screen. Everything here is a value in, a value out.
 */

export type Operator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "greater_than_or_equals"
  | "less_than"
  | "less_than_or_equals"
  | "contains"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty"

/**
 * ⚠️ **An unknown operator answers `false`, and never throws.** The vocabulary belongs to the backend;
 * one it adds before this interface knows about it must cost a rule that does not fire, not a form that
 * does not render.
 *
 * ⚠️ **Comparison is case-insensitive, and numeric comparison only applies when BOTH sides parse.**
 * `"10" > "9"` is true as numbers and false as strings, and a field holding `"abc"` must not silently
 * satisfy `greater_than 5` because `NaN` propagated somewhere.
 */
export function evaluateOperator(operator: Operator | string, actualValue: string, expectedValue: string): boolean {
  const numericActual = Number.parseFloat(actualValue)
  const numericExpected = Number.parseFloat(expectedValue)
  const hasNumericValues = !Number.isNaN(numericActual) && !Number.isNaN(numericExpected)

  switch (operator) {
    case "equals":
      return actualValue.toLowerCase() === expectedValue.toLowerCase()
    case "not_equals":
      return actualValue.toLowerCase() !== expectedValue.toLowerCase()
    case "greater_than":
      return hasNumericValues && numericActual > numericExpected
    case "greater_than_or_equals":
      return hasNumericValues && numericActual >= numericExpected
    case "less_than":
      return hasNumericValues && numericActual < numericExpected
    case "less_than_or_equals":
      return hasNumericValues && numericActual <= numericExpected
    case "contains":
      return actualValue.toLowerCase().includes(expectedValue.toLowerCase())
    case "starts_with":
      return actualValue.toLowerCase().startsWith(expectedValue.toLowerCase())
    case "ends_with":
      return actualValue.toLowerCase().endsWith(expectedValue.toLowerCase())
    case "is_empty":
      return actualValue.trim() === ""
    case "is_not_empty":
      return actualValue.trim() !== ""
    default:
      return false
  }
}

/**
 * Whether one rule is satisfied by the values currently in the form.
 *
 * ⚠️ **A missing value is an empty string, not `undefined`.** Every value in a form is a string —
 * that is the contract with the backend — so an absent field must compare as blank rather than as
 * nothing, or `is_empty` would answer `false` for a field nobody has touched.
 */
export function evaluateCondition(condition: FieldCondition, values: Record<string, string>): boolean {
  const actualValue = values[condition.triggerFieldName] ?? ""

  if (condition.operator === "is_empty") {
    return actualValue.trim() === ""
  }

  if (condition.operator === "is_not_empty") {
    return actualValue.trim() !== ""
  }

  return evaluateOperator(condition.operator, actualValue, condition.expectedValue ?? "")
}

/**
 * Whether a field shows.
 *
 * ⚠️ **No rule means visible.** A form with no conditions at all is the ordinary case, and defaulting
 * the other way would make every field disappear the day somebody forgets to write one.
 */
export function resolveVisible(
  fieldId: string,
  fieldConditions: Record<string, FieldCondition>,
  values: Record<string, string>,
): boolean {
  const condition = fieldConditions[fieldId]

  if (!condition) {
    return true
  }

  const satisfied = evaluateCondition(condition, values)

  if (condition.action === "show") {
    return satisfied
  }

  if (condition.action === "hide") {
    return !satisfied
  }

  return true
}

/**
 * Whether a field is required right now.
 *
 * ⚠️ **A rule can only ADD a requirement or lift one; it never replaces the field's own answer.** An
 * unsatisfied `require` falls back to what the field itself says, which is why both branches return
 * `baseRequired` rather than `false` — otherwise attaching a conditional rule to an already-required
 * field would quietly make it optional.
 */
export function resolveRequired(
  fieldId: string,
  baseRequired: boolean,
  fieldConditions: Record<string, FieldCondition>,
  values: Record<string, string>,
): boolean {
  const condition = fieldConditions[fieldId]

  if (!condition) {
    return baseRequired
  }

  const satisfied = evaluateCondition(condition, values)

  if (condition.action === "require") {
    return satisfied ? true : baseRequired
  }

  if (condition.action === "optional") {
    return satisfied ? false : baseRequired
  }

  return baseRequired
}

/**
 * What a virtual field's PHANTOM child must already hold for an entry being edited to look the way it
 * was saved.
 *
 * A virtual field is a chooser: its phantom child holds the choice, and the data children show or hide
 * against it. ⚠️ **The chooser's own value is never stored** — only the data child that was filled in
 * is — so an entry reopened for editing would come back with the chooser blank and every child hidden,
 * which reads as "the data is gone". This walks the child conditions backwards: a data child that holds
 * a value tells us which choice must have been made.
 *
 * ⚠️ **It only ever fills a phantom that is empty**, so a value genuinely stored for one wins over
 * anything inferred here.
 */
export function withInferredPhantoms(form: FormDetail, initialValues: Record<string, string>): Record<string, string> {
  const result = { ...initialValues }

  for (const field of form.fields) {
    if (!field || field.status === "DELETED" || field.usageType !== "VIRTUAL") {
      continue
    }

    const fieldDetail = field as FieldDetail
    const children = fieldDetail.children ?? []
    const childConditions = fieldDetail.childConditions ?? {}
    const phantomChild = children.find((child) => child.usageType === "PHANTOM")

    if (!phantomChild || result[phantomChild.name]) {
      continue
    }

    for (const [childId, condition] of Object.entries(childConditions)) {
      if (
        condition.triggerFieldName !== phantomChild.name ||
        condition.action !== "show" ||
        !condition.expectedValue
      ) {
        continue
      }

      const dataChild = children.find((child) => child.id === childId)

      if (dataChild && result[dataChild.name]) {
        result[phantomChild.name] = condition.expectedValue
        break
      }
    }
  }

  return result
}

/**
 * A field's options as *this entry* should read them: the labels the server already resolved first,
 * then the field's own hand-typed rows.
 *
 * A field whose choices come from a source has no rows to look a value up in — the value is an entry
 * id, a location id, or something an expression computed — so the server resolves the page in one
 * lookup per field and sends the answer down on the entry. Folding it into the same `options` shape
 * every renderer already speaks means a reference reads as a name everywhere without a single component
 * learning what a reference is.
 *
 * ⚠️ **Resolved labels come first because the first match wins**, so they beat a stale row carrying the
 * same value; the rows stay behind them as the fallback for anything the server did not resolve.
 */
export function optionsWithResolvedLabels(
  options: Array<{ optionValue: string; optionLabel: string }> = [],
  resolved: Record<string, string> = {},
): Array<{ optionValue: string; optionLabel: string }> {
  const resolvedPairs = Object.entries(resolved).map(([optionValue, optionLabel]) => ({ optionValue, optionLabel }))

  return [...resolvedPairs, ...options]
}
