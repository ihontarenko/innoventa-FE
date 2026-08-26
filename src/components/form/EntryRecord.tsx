import { ImageOff } from "lucide-react"
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
 *
 * ⚠️ **What names the row and what the row *is* are one surface, not two.** The thumbnail, the name and
 * the marked specifications share a single card with a hairline between them, the way a distributor's
 * own parametric sheet is laid out — a title floating above an unrelated grey box is what made this
 * screen read as unfinished.
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
  const picture = imageField ? (entry.fieldValues[imageField.name] ?? "") : ""

  return (
    <div className="flex flex-col gap-5">
      <section className="overflow-hidden rounded-lg border bg-card">
        <div className={cn("flex items-start gap-4", dense ? "p-3" : "p-4")}>
          {/* ⚠️ A frame is drawn for a type that HAS a picture field and a row that has not filled it,
              and nothing at all for a type that has none. The first is a gap somebody can close; the
              second is not a gap, and a placeholder would invent one. */}
          {imageField &&
            (picture ? (
              <FieldValue
                value={picture}
                elementType="IMAGE"
                imageClassName={cn(
                  "shrink-0 rounded-md border bg-background object-contain p-1.5",
                  dense ? "size-20" : "size-28",
                )}
              />
            ) : (
              <span
                aria-hidden="true"
                className={cn(
                  "grid shrink-0 place-items-center rounded-md border border-dashed bg-muted/30 text-muted-foreground/50",
                  dense ? "size-20" : "size-28",
                )}
              >
                <ImageOff className="size-5" />
              </span>
            ))}

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2
              className={cn("font-display leading-tight font-semibold tracking-tight", dense ? "text-lg" : "text-2xl")}
            >
              {title || <span className="text-muted-foreground">Untitled</span>}
            </h2>

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
          </div>

          <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <Badge variant="secondary">{form.codename ?? form.name}</Badge>
            {entry.shareToken && <Badge variant="outline">🔗 Shared</Badge>}
          </span>
        </div>

        {highlighted.length > 0 && (
          <FactGrid form={form} entry={entry} fields={highlighted} dense={dense} emphasised />
        )}
      </section>

      {rest.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">Details</h3>
          <FactGrid form={form} entry={entry} fields={rest} dense={dense} />
        </section>
      )}

      {/* ⚠️ After the facts, never instead of them. A widget is a *reading* of the answers — the
          resistance drawn as bands, the quantity as a stock light — and the answers themselves stay
          the record. */}
      <EntryWidgets formId={form.id} entry={entry} />
    </div>
  )
}

/**
 * The fields themselves, as a hairline grid.
 *
 * ⚠️ **One pixel of the border colour showing between the cells, rather than a border on each cell.**
 * The grid is `gap-px` over a border-coloured backing with the cells painted on top, which is the only
 * arrangement that keeps the rule even wherever the count and the breakpoint land — per-cell borders
 * double up on one edge and disappear on another the moment a row is short.
 *
 * ⚠️ **Which is also why a short last row is padded with blanks.** Without them the backing shows
 * through as a bar of border colour where the missing cells would have been, and that reads as a
 * rendering fault rather than as a form with seven fields.
 */
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
  if (form.fields.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
        This form has no fields.
      </p>
    )
  }

  return (
    <div
      className={cn(
        "grid gap-px bg-border",
        !dense && "sm:grid-cols-2 xl:grid-cols-3",
        emphasised ? "border-t" : "overflow-hidden rounded-lg border",
      )}
    >
      {fields.map((field) => {
        const stored = entry.fieldValues[field.name] ?? ""
        const isComposite = field.elementType === "COMPLEX_COMPOSITE" || field.elementType === "NONE"

        return (
          <div
            key={field.id}
            className={cn(
              "flex",
              emphasised ? "bg-muted/40" : "bg-card",
              dense ? "items-baseline gap-3 px-3 py-2" : "flex-col gap-1 px-4 py-3",
            )}
          >
            <span
              className={cn(
                "text-[10px] leading-4 tracking-[0.06em] text-muted-foreground uppercase",
                dense && "w-2/5 shrink-0",
              )}
            >
              {field.icon ? `${field.icon} ` : ""}
              {field.label}
            </span>

            <span
              className={cn(
                "min-w-0 truncate",
                dense ? "flex-1 text-right text-sm" : "text-sm",
                emphasised && (dense ? "font-semibold" : "text-base font-semibold"),
              )}
            >
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

      {!dense && <RowFillers count={fields.length} emphasised={emphasised} />}
    </div>
  )
}

/**
 * The blanks that finish a short last row — one at the two-column breakpoint, up to two at the three.
 *
 * ⚠️ **Counted per breakpoint rather than once**, because the same seven fields leave one hole at `sm:`
 * and two at `xl:`, and a single filler would paint over one grid and under the other.
 */
function RowFillers({ count, emphasised }: { count: number; emphasised: boolean }) {
  const wideHoles = (3 - (count % 3)) % 3
  const surface = emphasised ? "bg-muted/40" : "bg-card"

  return (
    <>
      {count % 2 === 1 && <span aria-hidden="true" className={cn("hidden sm:block xl:hidden", surface)} />}

      {Array.from({ length: wideHoles }, (_, position) => (
        <span key={position} aria-hidden="true" className={cn("hidden xl:block", surface)} />
      ))}
    </>
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
