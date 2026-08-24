import type { FieldDetail, FormDetail } from "@/types"
import { resolveVisible } from "./formConditions"

/**
 * What happens to the answers when a form's own rules change what is on screen.
 *
 * ⚠️ **Pure, and out of the renderer on purpose.** Both rules below are invisible when they go wrong —
 * a value quietly submitted for a field nobody could see, or an internal marker quietly stored as
 * though somebody had typed it — and neither is something a screenshot would show.
 */

/** A live field: one that exists and has not been deleted out from under the form. */
function isLive(field: FieldDetail): boolean {
  return !!field && field.status !== "DELETED"
}

/** A virtual field that groups children, as opposed to a composite that joins them into one value. */
function isChildBearing(field: FieldDetail): boolean {
  return field.usageType === "VIRTUAL" && field.elementType !== "COMPLEX_COMPOSITE"
}

/**
 * Drops the answers of everything the current values have hidden.
 *
 * ⚠️ **Hiding a field must remove its answer, not just stop drawing it.** Otherwise a form that asks
 * "do you have a serial number?" → "no" still submits the serial number typed before the answer
 * changed, and the entry ends up holding a fact its own form says cannot exist.
 *
 * ⚠️ **A hidden group takes its children with it** — the group is what the condition names, and the
 * children are only reachable through it, so leaving their answers behind is the same bug one level
 * down.
 */
export function withoutHiddenValues(form: FormDetail, values: Record<string, string>): Record<string, string> {
  const next = { ...values }
  const fieldConditions = form.fieldConditions ?? {}

  for (const field of form.fields) {
    if (!isLive(field)) {
      continue
    }

    const condition = fieldConditions[field.id]

    // Only visibility rules clear anything. A `require`/`optional` rule changes what must be answered,
    // never whether the answer that is already there is still meant.
    if (!condition || (condition.action !== "show" && condition.action !== "hide")) {
      continue
    }

    if (resolveVisible(field.id, fieldConditions, next)) {
      continue
    }

    delete next[field.name]

    if (isChildBearing(field)) {
      for (const child of field.children ?? []) {
        delete next[child.name]
      }
    }
  }

  // A child can be hidden by a rule of its own, inside a group that is itself perfectly visible.
  for (const field of form.fields) {
    if (!isLive(field) || !isChildBearing(field)) {
      continue
    }

    const childConditions = field.childConditions ?? {}

    for (const child of field.children ?? []) {
      const childCondition = childConditions[child.id]

      if (!childCondition || (childCondition.action !== "show" && childCondition.action !== "hide")) {
        continue
      }

      if (!resolveVisible(child.id, childConditions, next)) {
        delete next[child.name]
      }
    }
  }

  return next
}

/**
 * The values as they should be sent — without the phantoms.
 *
 * ⚠️ **A phantom is the form's own bookkeeping, not an answer.** It is the hidden chooser a virtual
 * field uses to decide which of its children to show; storing it would put a control's internal state
 * into the entry, where every reader afterwards has to know to ignore it. `withInferredPhantoms`
 * reconstructs it on the way back in, which is what makes dropping it here safe.
 */
export function withoutPhantomValues(form: FormDetail, values: Record<string, string>): Record<string, string> {
  const phantomNames = new Set<string>()

  for (const field of form.fields) {
    if (field.usageType === "PHANTOM") {
      phantomNames.add(field.name)
    }

    if (!isChildBearing(field)) {
      continue
    }

    for (const child of field.children ?? []) {
      if (child.usageType === "PHANTOM") {
        phantomNames.add(child.name)
      }
    }
  }

  if (phantomNames.size === 0) {
    return values
  }

  return Object.fromEntries(Object.entries(values).filter(([name]) => !phantomNames.has(name)))
}

/**
 * The field errors a rejected submission carries, flattened to one message per field.
 *
 * ⚠️ **The backend may send an array per field**; the form has room for one line under a control, and
 * the first is the one that names the reason the others follow from.
 */
export function fieldErrorsOf(error: unknown): Record<string, string> | null {
  const typedError = error as {
    response?: { data?: { fieldErrors?: Record<string, string | string[]> } }
  }
  const fieldErrors = typedError?.response?.data?.fieldErrors

  if (!fieldErrors) {
    return null
  }

  return Object.fromEntries(
    Object.entries(fieldErrors).map(([name, message]) => [name, Array.isArray(message) ? message[0] : message]),
  )
}

/**
 * Whether a rejected submission is one the form itself can draw — a refusal that names fields.
 *
 * ⚠️ **The one question a wrapper around `DynamicForm`'s `onSubmit` must ask before it catches.**
 * That callback runs inside the form's own `try`, so a caller that swallows the rejection swallows the
 * field messages with it: the submission fails, a toast says so, and not one control turns red. A
 * caller that catches at all has to re-throw this kind and handle only the rest.
 */
export function isFieldValidationError(error: unknown): boolean {
  const fieldErrors = fieldErrorsOf(error)

  return !!fieldErrors && Object.keys(fieldErrors).length > 0
}
