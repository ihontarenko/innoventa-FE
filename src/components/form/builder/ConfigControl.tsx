import { Input, NativeSelect, Switch, Textarea, cn } from "@jmouse/ui"
import type { ConfigEntry } from "@/lib/formConfigCatalogue"
import type { FieldDetail } from "@/types"

/**
 * One configuration key, drawn as whatever it holds.
 *
 * ⚠️ **One renderer for every key**, driven by the catalogue. The alternative — a bespoke block per
 * key — is what left half of them with no control at all in the old panel.
 *
 * ⚠️ **A blank value removes the key rather than storing `""`.** The backend reads "absent" and "empty"
 * differently for several of these: an absent `display.primary_field` falls back to the first field,
 * while an empty one is a field name that matches nothing.
 */
export function ConfigControl({
  entry,
  value,
  fields,
  onChange,
}: {
  entry: ConfigEntry
  value: string
  fields: FieldDetail[]
  onChange: (value: string) => void
}) {
  const { control } = entry

  if (control.kind === "field" || control.kind === "fields") {
    // ⚠️ Narrowed by element type where the key only makes sense for some — offering a text field as a
    // thumbnail is offering a setting that cannot work.
    // ⚠️ Both kinds honour it. While only the single-field one did, a multi-field key that names element
    // types — *which values become filter links* — offered every field on the form, including the ones a
    // filter over them would give a one-row list per distinct measurement.
    const eligible = control.accepts
      ? fields.filter((field) => control.accepts!.includes(field.elementType))
      : fields

    if (control.kind === "fields") {
      const selected = value ? value.split(",").map((name) => name.trim()).filter(Boolean) : []

      return (
        <div className="flex flex-wrap gap-1.5">
          {eligible.map((field) => {
            const isOn = selected.includes(field.name)

            return (
              <button
                key={field.id}
                type="button"
                aria-pressed={isOn}
                onClick={() =>
                  onChange(
                    (isOn ? selected.filter((name) => name !== field.name) : [...selected, field.name]).join(","),
                  )
                }
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  isOn ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground",
                )}
              >
                {field.label}
              </button>
            )
          })}
          {eligible.length === 0 && <span className="text-xs text-muted-foreground">No fields to choose from.</span>}
        </div>
      )
    }

    return (
      <NativeSelect
        className="w-full"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">— none</option>
        {eligible.map((field) => (
          <option key={field.id} value={field.name}>
            {field.label}
          </option>
        ))}
      </NativeSelect>
    )
  }

  if (control.kind === "boolean") {
    return (
      <Switch
        checked={value === "true"}
        // ⚠️ Off writes `"false"` rather than removing the key: several of these default to ON, so an
        // absent key and an off switch are different answers.
        onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
      />
    )
  }

  if (control.kind === "choice") {
    return (
      <NativeSelect
        className="w-full"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">— default</option>
        {control.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    )
  }

  if (control.kind === "colour") {
    return (
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={entry.label}
          className="size-8 cursor-pointer rounded-md border bg-transparent p-0"
          value={value || "#1E78A4"}
          onChange={(event) => onChange(event.target.value)}
        />
        <Input
          className="font-mono text-xs"
          placeholder="#1E78A4"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    )
  }

  if (control.long) {
    return (
      <Textarea
        rows={2}
        placeholder={control.placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  return <Input placeholder={control.placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
}
