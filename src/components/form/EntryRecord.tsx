import { Badge, cn } from "@jmouse/ui"
import { EntryWidgets } from "@/components/form/EntryWidgets"
import { FieldValue } from "@/components/form/FieldValue"
import { readFormConfigs } from "@/lib/formConfigs"
import type { FieldDetail, FormDetail, FormEntry } from "@/types"

/**
 * One row read as a spec sheet, in the order its form says it should be read.
 *
 * ⚠️ **The order is the form's, not this file's.** Title, subtitle, thumbnail and the highlighted fields
 * all come out of the same `display.*` configuration the inventory table reads — so a type that has been
 * set up once looks arranged everywhere, and one that has not looks the same everywhere too. A second,
 * cleverer ordering here would make the same row read differently on two screens, and nobody could say
 * which was the record.
 *
 * ⚠️ **Highlighted fields sit apart, above the rest.** Somebody opening a resistor wants the resistance
 * and the tolerance, not the twenty-second field alphabetically; the ones nobody marked still all appear
 * below, because a spec sheet that hid fields would make "not filled in" and "not shown" identical.
 */
export function EntryRecord({
  form,
  entry,
  dense = false,
}: {
  form: FormDetail
  entry: FormEntry
  /**
   * One column, for a drawer.
   *
   * ⚠️ **A prop rather than a breakpoint, because the breakpoint is the wrong measurement.** Tailwind's
   * `sm:` asks how wide the *window* is; a sheet is 36rem wide on a 2560px screen, so the responsive
   * grid would put three columns into a column. The caller knows how much room it gave.
   */
  dense?: boolean
}) {
  const configs = readFormConfigs(form.config)

  const byName = new Map(form.fields.map((field) => [field.name, field]))
  const fieldAt = (name: string | null) => (name ? byName.get(name) : undefined)

  const titleField = fieldAt(configs.primaryField) ?? form.fields[0]
  const subtitleField = fieldAt(configs.secondaryField)
  const imageField = fieldAt(configs.imageField)

  const highlighted = configs.priorityFields
    .map((name) => byName.get(name))
    .filter((field): field is FieldDetail => !!field && field.name !== imageField?.name)

  const highlightedNames = new Set(highlighted.map((field) => field.name))
  const shownAbove = new Set(
    [titleField?.name, subtitleField?.name, imageField?.name].filter((name): name is string => !!name),
  )

  const rest = form.fields.filter(
    (field) => !highlightedNames.has(field.name) && !shownAbove.has(field.name) && field.usageType !== "EMBEDDABLE",
  )

  const title = titleField ? (entry.fieldValues[titleField.name] ?? "") : ""

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start gap-4">
        {imageField && entry.fieldValues[imageField.name] && (
          <FieldValue
            value={entry.fieldValues[imageField.name]}
            elementType="IMAGE"
            imageClassName="size-28 rounded-md border bg-background object-contain p-1.5"
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-lg font-semibold">{title || <span className="text-muted-foreground">Untitled</span>}</h2>

          {subtitleField && entry.fieldValues[subtitleField.name] && (
            <p className="text-sm text-muted-foreground">
              <FieldValue
                value={entry.fieldValues[subtitleField.name]}
                elementType={subtitleField.elementType}
                unit={subtitleField.unit}
                options={subtitleField.options}
              />
            </p>
          )}

          <span className="flex flex-wrap items-center gap-1.5 pt-1">
            <Badge variant="secondary">{form.codename ?? form.name}</Badge>
            {entry.shareToken && <Badge variant="outline">🔗 Shared</Badge>}
          </span>
        </div>
      </div>

      {highlighted.length > 0 && (
        <FactGrid form={form} entry={entry} fields={highlighted} dense={dense} emphasised />
      )}

      {rest.length > 0 && <FactGrid form={form} entry={entry} fields={rest} dense={dense} />}

      {/* ⚠️ After the facts, never instead of them. A widget is a *reading* of the answers — the
          resistance drawn as bands, the quantity as a stock light — and the answers themselves stay
          the record. */}
      <EntryWidgets formId={form.id} entry={entry} />
    </div>
  )
}

function FactGrid({
  form,
  entry,
  fields,
  dense = false,
  emphasised = false,
}: {
  form: FormDetail
  entry: FormEntry
  fields: FieldDetail[]
  dense?: boolean
  emphasised?: boolean
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-x-4 gap-y-0",
        !dense && "sm:grid-cols-2 xl:grid-cols-3",
        emphasised && "rounded-md border bg-muted/30 p-3",
      )}
    >
      {fields.map((field) => {
        const stored = entry.fieldValues[field.name] ?? ""
        const isComposite = field.elementType === "COMPLEX_COMPOSITE" || field.elementType === "NONE"

        return (
          <div key={field.id} className="flex flex-col gap-0.5 border-b py-1.5 last:border-b-0 sm:border-b">
            <span className="text-[10px] tracking-[0.05em] text-muted-foreground uppercase">
              {field.icon ? `${field.icon} ` : ""}
              {field.label}
            </span>

            <span className={cn("text-sm", emphasised && "font-medium")}>
              <FieldValue
                value={stored}
                elementType={field.elementType}
                unit={field.unit}
                options={withEntryLabels(field, entry)}
                children={
                  isComposite
                    ? (field.children ?? []).map((child) => ({
                        label: child.label,
                        unit: child.unit,
                        value: entry.fieldValues[child.name] ?? "",
                      }))
                    : undefined
                }
              />
            </span>
          </div>
        )
      })}

      {/* Keeps the grid honest when a form has one field — an odd count would otherwise leave a
          borderless orphan that reads as a rendering fault. */}
      {fields.length === 1 && <span className="hidden sm:block" aria-hidden="true" />}
      {form.fields.length === 0 && <span className="text-xs text-muted-foreground">This form has no fields.</span>}
    </div>
  )
}

/** ⚠️ Same rule as the table: a *sourced* value's label comes with the row, not with the field. */
function withEntryLabels(field: FieldDetail, entry: FormEntry) {
  const resolved = entry.optionLabels?.[field.name]

  if (!resolved) {
    return field.options
  }

  return field.options.map((option) => ({
    ...option,
    optionLabel: resolved[option.optionValue] ?? option.optionLabel,
  }))
}
