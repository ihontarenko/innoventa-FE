import { Check } from "lucide-react"
import { Switch, cn } from "@jmouse/ui"
import type { ControlProperties } from "./types"

/**
 * The two yes/no fields, and they are not the same question.
 *
 * ⚠️ **`CHECKBOX` stores `"true"` or `""`; `TOGGLE` stores `"true"` or `"false"`.** That asymmetry is
 * deliberate and is the backend's: an unticked box means *nothing was said*, which is why it empties
 * the value, while a toggle always says one of two things. Normalising the two here would change what a
 * blank means to every consumer of the entry.
 */

export function CheckboxControl({ field, value, onChange }: ControlProperties) {
  const checked = value === "true"

  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked ? "true" : "")}
      />
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-input",
        )}
      >
        {checked && <Check className="size-3" />}
      </span>
      {/* `checkboxLabel` is the wording beside the box — often a sentence to agree with, which is not
          the field's own label. Falling back to the label keeps a field that never set one legible. */}
      <span>{field.attributes["checkboxLabel"] ?? field.label}</span>
    </label>
  )
}

export function ToggleControl({ field, value, onChange }: ControlProperties) {
  const checked = value === "true"

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">
        {checked ? (field.attributes["labelOn"] ?? "On") : (field.attributes["labelOff"] ?? "Off")}
      </span>
      <Switch checked={checked} onCheckedChange={(next) => onChange(next ? "true" : "false")} />
    </div>
  )
}
