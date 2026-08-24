import { Check } from "lucide-react"
import { cn } from "@jmouse/ui"
import { optionsOf } from "@/lib/fieldOptions"
import { selectedValuesOf, toggleValue, type ControlProperties } from "./types"

/**
 * Picking from a list: `SELECT`, `MULTISELECT`, `RADIO`, `CHECKBOXES`.
 *
 * ⚠️ **Four element types, one set of choices** — where they come from is `fieldOptions`'s question, so
 * a field whose options are drawn by a provider needs no branch of its own in any of these.
 *
 * ⚠️ **Pills rather than native controls for the multi-value ones.** A row of checkboxes is taller than
 * the field beside it and reads as a form inside a form; the pill row is what makes a schema of twenty
 * fields fit on one screen. `RADIO` keeps a real `<input type="radio">` underneath its pill, because
 * arrow-key navigation within a group is behaviour no `<button>` gets for free.
 */

const PILL_STYLES = "rounded-full border px-2.5 py-1 text-xs transition-colors"
const PILL_ON = "border-primary bg-primary text-primary-foreground"
const PILL_OFF = "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground"

function NoChoices() {
  return <span className="text-xs text-muted-foreground">No choices configured.</span>
}

export function SelectControl({ field, value, onChange, hasError }: ControlProperties) {
  const options = optionsOf(field)

  return (
    <select
      id={`field-${field.id}`}
      aria-invalid={hasError || undefined}
      className={cn(
        "h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs",
        hasError && "border-destructive",
      )}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Select…</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export function MultiSelectControl({ field, value, onChange }: ControlProperties) {
  const options = optionsOf(field)
  const selected = selectedValuesOf(value)

  if (options.length === 0) {
    return <NoChoices />
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={selected.includes(option.value)}
          className={cn(PILL_STYLES, selected.includes(option.value) ? PILL_ON : PILL_OFF)}
          onClick={() => onChange(toggleValue(value, option.value))}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function RadioControl({ field, value, onChange }: ControlProperties) {
  const options = optionsOf(field)

  if (options.length === 0) {
    return <NoChoices />
  }

  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(PILL_STYLES, "cursor-pointer", value === option.value ? PILL_ON : PILL_OFF)}
        >
          <input
            type="radio"
            className="sr-only"
            name={`field-${field.id}`}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  )
}

export function CheckboxesControl({ field, value, onChange }: ControlProperties) {
  const options = optionsOf(field)
  const selected = selectedValuesOf(value)

  if (options.length === 0) {
    return <NoChoices />
  }

  return (
    <div className="flex flex-col gap-1">
      {options.map((option) => (
        <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="sr-only"
            checked={selected.includes(option.value)}
            onChange={() => onChange(toggleValue(value, option.value))}
          />
          <span
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
              selected.includes(option.value) ? "border-primary bg-primary text-primary-foreground" : "border-input",
            )}
          >
            {selected.includes(option.value) && <Check className="size-3" />}
          </span>
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  )
}
