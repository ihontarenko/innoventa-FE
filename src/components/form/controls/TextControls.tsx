import { Input, Textarea, cn } from "@jmouse/ui"
import { htmlAttributesOf } from "@/lib/fieldAttributes"
import type { ControlProperties } from "./types"

/**
 * The controls that are a box you type into: `TEXT`, `EMAIL`, `URL`, `TEXTAREA`, `DATE`.
 *
 * ⚠️ **The type attribute is the validation.** `EMAIL` and `URL` are not decoration — the browser
 * checks them, offers the right keyboard on a phone, and autofills differently. They are one field
 * type each precisely so that behaviour arrives for free.
 */

/**
 * The hint inside the box — and **only** what was actually written as a placeholder.
 *
 * ⚠️ **It used to fall back to `field.description`, and `FieldRow` renders that description underneath
 * as the hint.** So a field with a description and no placeholder printed the same sentence twice, once
 * inside the box and once below it — visible on the public feedback form, which is embedded on the
 * landing page. Faithfully ported from the old interface, which had the same pair.
 *
 * ⚠️ **The hint won, not the placeholder, and that is the whole reason to pick one.** A placeholder
 * disappears the moment somebody types — so guidance put there is guidance that vanishes exactly when
 * it is being followed. A description is advice about filling the field in; it belongs under the field,
 * where it survives.
 */
function placeholderOf({ field }: Pick<ControlProperties, "field">): string {
  return field.attributes["placeholder"] ?? ""
}

export function TextControl({ field, value, onChange, hasError }: ControlProperties) {
  const inputType = field.elementType === "EMAIL" ? "email" : field.elementType === "URL" ? "url" : "text"

  return (
    <Input
      id={`field-${field.id}`}
      type={inputType}
      aria-invalid={hasError || undefined}
      className={cn(hasError && "border-destructive")}
      {...htmlAttributesOf(field.attributes, "placeholder")}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholderOf({ field })}
    />
  )
}

export function TextareaControl({ field, value, onChange, hasError }: ControlProperties) {
  return (
    <Textarea
      id={`field-${field.id}`}
      rows={3}
      aria-invalid={hasError || undefined}
      className={cn(hasError && "border-destructive")}
      {...htmlAttributesOf(field.attributes, "placeholder")}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholderOf({ field })}
    />
  )
}

export function DateControl({ field, value, onChange, hasError }: ControlProperties) {
  return (
    <Input
      id={`field-${field.id}`}
      type="date"
      aria-invalid={hasError || undefined}
      className={cn("font-mono", hasError && "border-destructive")}
      {...htmlAttributesOf(field.attributes)}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
