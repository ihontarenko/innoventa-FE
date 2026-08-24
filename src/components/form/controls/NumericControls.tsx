import { Input, cn } from "@jmouse/ui"
import { htmlAttributesOf } from "@/lib/fieldAttributes"
import { unitOptionsOf } from "@/lib/fieldOptions"
import { ChildFieldControl } from "./ChildFieldControl"
import type { ControlProperties } from "./types"

/**
 * Numbers, and the two shapes built out of them.
 *
 * ⚠️ **`SIMPLE_COMPOSITE` and `RANGE` are both `a|b` in one string**, and the pipe is the contract with
 * the backend — `22|pF` is a value with a unit, `1|5` is a span. Nothing here may store them as two
 * fields or as JSON; `normalizeValueForUI` is what turns them back into something a person reads.
 */

/** A plain number with its unit printed beside it, when the field has one. */
export function NumberControl({ field, value, onChange, hasError }: ControlProperties) {
  return (
    <div className="flex items-center gap-2">
      <Input
        id={`field-${field.id}`}
        type="number"
        aria-invalid={hasError || undefined}
        className={cn("font-mono", hasError && "border-destructive")}
        {...htmlAttributesOf(field.attributes, "placeholder", "step")}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="0"
        // ⚠️ `any` rather than 1: a capacitance of 4.7 is refused by a browser stepping in whole
        // numbers, and the refusal happens at submit with no message beside the field.
        step={field.attributes["step"] ?? "any"}
      />
      {field.unit && <span className="shrink-0 font-mono text-xs text-muted-foreground">{field.unit}</span>}
    </div>
  )
}

/** A number and the unit it is in — one value, `number|unit`. */
export function SimpleCompositeControl({ field, value, onChange, hasError }: ControlProperties) {
  const [number = "", unit = ""] = value.split("|")
  const unitOptions = unitOptionsOf(field)
  /**
   * ⚠️ **The fallback has to be what gets *written*, not only what gets shown.** The select displays the
   * first unit when nothing was picked; if the number's `onChange` then writes the raw `unit`, it writes
   * an empty one — the control reads "10 mΩ" on screen and stores `10|`. Nothing downstream can recover
   * the missing half, so the value is silently dimensionless: it never matches in a parametric search and
   * renders as a bare `10` wherever it is read.
   */
  const effectiveUnit = unit || unitOptions[0]?.value || ""

  return (
    <div className="flex items-center gap-2">
      <Input
        id={`field-${field.id}`}
        type="number"
        aria-invalid={hasError || undefined}
        className={cn("font-mono", hasError && "border-destructive")}
        {...htmlAttributesOf(field.attributes, "placeholder", "step")}
        value={number}
        onChange={(event) => onChange(`${event.target.value}|${effectiveUnit}`)}
        placeholder="0"
        step={field.attributes["step"] ?? "any"}
      />

      {unitOptions.length > 0 && (
        <select
          aria-label="Unit"
          className={cn(
            "h-9 shrink-0 rounded-md border bg-transparent px-2 font-mono text-sm shadow-xs",
            hasError && "border-destructive",
          )}
          value={effectiveUnit}
          onChange={(event) => onChange(`${number}|${event.target.value}`)}
        >
          {!effectiveUnit && <option value="">—</option>}
          {unitOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

/** A span — `min|max`, both optional while it is being filled in. */
export function RangeControl({ field, value, onChange, hasError }: ControlProperties) {
  const [minimum = "", maximum = ""] = value.split("|")

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 items-center gap-1.5">
        <Input
          type="number"
          step="any"
          aria-label="Minimum"
          aria-invalid={hasError || undefined}
          className={cn("font-mono", hasError && "border-destructive")}
          {...htmlAttributesOf(field.attributes, "placeholder")}
          value={minimum}
          onChange={(event) => onChange(`${event.target.value}|${maximum}`)}
          placeholder="min"
        />
        {field.unit && <span className="shrink-0 font-mono text-xs text-muted-foreground">{field.unit}</span>}
      </div>

      <span className="shrink-0 text-muted-foreground">→</span>

      <div className="flex flex-1 items-center gap-1.5">
        <Input
          type="number"
          step="any"
          aria-label="Maximum"
          aria-invalid={hasError || undefined}
          className={cn("font-mono", hasError && "border-destructive")}
          {...htmlAttributesOf(field.attributes, "placeholder")}
          value={maximum}
          onChange={(event) => onChange(`${minimum}|${event.target.value}`)}
          placeholder="max"
        />
        {field.unit && <span className="shrink-0 font-mono text-xs text-muted-foreground">{field.unit}</span>}
      </div>
    </div>
  )
}

/**
 * Several children in one row, joined by pipes in the order they are declared.
 *
 * ⚠️ **A segment's position is its identity**, so the array is padded to the number of children before
 * it is joined. Skipping that turns "third child filled, first two empty" into a two-segment value the
 * next reader parses as the first two children.
 */
export function ComplexCompositeControl({ field, value, onChange, hasError }: ControlProperties) {
  const children = field.children ?? []
  const segments = value ? value.split("|") : []

  function setSegment(segmentIndex: number, segmentValue: string) {
    const updated = [...segments]
    updated[segmentIndex] = segmentValue

    while (updated.length < children.length) {
      updated.push("")
    }

    onChange(updated.join("|"))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {children.map((child, segmentIndex) => (
        <ChildFieldControl
          key={child.id}
          child={child}
          value={segments[segmentIndex] ?? ""}
          onChange={(segmentValue) => setSegment(segmentIndex, segmentValue)}
          hasError={hasError}
        />
      ))}
    </div>
  )
}
