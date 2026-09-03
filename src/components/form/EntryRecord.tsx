import type { ReactNode } from "react"
import { ImageOff } from "lucide-react"
import { Badge, cn } from "@jmouse/ui"
import { EntryPanel } from "@/components/entry/EntryPanel"
import { EntryWidgets } from "@/components/form/EntryWidgets"
import { FieldValue } from "@/components/form/FieldValue"
import { optionsWithLabels, readableValueOf } from "@/lib/entryLabels"
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
 * ⚠️ **Two arrangements, ONE implementation.** The record page lays the identity across the top and the
 * details down a column beside a tabbed pane; the drawer and the public link stack them. Both are built
 * from `EntryIdentityCard` and `EntryDetailsList` below rather than from two copies of the same markup —
 * two read views is exactly how a field comes to render one way here and another way there.
 */
export function EntryRecord({
  form,
  entry,
  dense = false,
  collapseBlanks = false,
  omitFields,
  afterHero,
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
  /**
   * Put the fields nobody has answered behind one line.
   *
   * ⚠️ **Opt-in, because hiding them is only right where something else says they exist.** A spec sheet
   * that quietly dropped its empty fields would make "not filled in" and "this type has no such field"
   * identical — the very confusion the record page's capability panels exist to undo. On a screen with
   * no such panels, every field stays visible and a dash is the honest answer.
   */
  collapseBlanks?: boolean
  /** Fields another part of the page has taken over — see `EntryDetailsList`. */
  omitFields?: string[]
  /** Rendered between the identity card and the details. */
  afterHero?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-5">
      <EntryIdentityCard form={form} entry={entry} dense={dense} />

      {afterHero}

      <EntryDetailsList
        form={form}
        entry={entry}
        dense={dense}
        collapseBlanks={collapseBlanks}
        omitFields={omitFields}
      />

      {/* ⚠️ After the facts, never instead of them. A widget is a *reading* of the answers — the
          resistance drawn as bands, the quantity as a stock light — and the answers themselves stay
          the record. */}
      <EntryWidgets formId={form.id} entry={entry} />
    </div>
  )
}

/**
 * What names the row, and the specifications somebody opened it for.
 *
 * ⚠️ **What names the row and what the row *is* are one surface, not two.** The thumbnail, the name and
 * the marked specifications share a single card with a hairline between them, the way a distributor's
 * own parametric sheet is laid out — a title floating above an unrelated grey box is what made this
 * screen read as unfinished.
 *
 * ⚠️ **Highlighted fields sit apart, above the rest.** Somebody opening a resistor wants the resistance
 * and the tolerance, not the twenty-second field alphabetically.
 */
export function EntryIdentityCard({
  form,
  entry,
  dense = false,
  highlightFallback,
}: {
  form: FormDetail
  entry: FormEntry
  dense?: boolean
  /**
   * What to put in the strip when the form marks nothing.
   *
   * ⚠️ **Supplied by the caller, never guessed here.** The page knows which fields it has already given
   * to a panel; this component does not, and a card that picked its own three would put the quantity in
   * the strip and again in the stock panel beside it.
   *
   * ⚠️ **And a strip of the wrong three beats no strip at all** — the same argument the inventory table
   * makes about columns. Two purposes where one has a band of specifications and the other has a bare
   * title bar do not read as one screen, and the difference is a setting nobody made rather than
   * anything true about the record.
   */
  highlightFallback?: FieldDetail[]
}) {
  const configs = readFormConfigs(form.config)
  const byName = new Map(form.fields.map((field) => [field.name, field]))
  const fieldAt = (name: string | null) => (name ? byName.get(name) : undefined)

  const titleField = fieldAt(configs.primaryField) ?? form.fields[0]
  const subtitleField = fieldAt(configs.secondaryField)
  const imageField = fieldAt(configs.imageField)

  const marked = configs.priorityFields
    .map((name) => byName.get(name))
    .filter((field): field is FieldDetail => !!field && field.name !== imageField?.name)

  const highlighted = marked.length > 0 ? marked : (highlightFallback ?? [])

  // ⚠️ Through the resolved labels: a source-backed title field holds an IDENTIFIER, and printing it
  // raw is how a position ends up titled `UT9qbvRJmqFaaiSQ` instead of `SS34 Schottky`.
  const title = readableValueOf(entry, titleField)
  const picture = imageField ? (entry.fieldValues[imageField.name] ?? "") : ""

  return (
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
          <h2 className={cn("font-display leading-tight font-semibold tracking-tight", dense ? "text-lg" : "text-2xl")}>
            {title || <span className="text-muted-foreground">Untitled</span>}
          </h2>

          {subtitleField && entry.fieldValues[subtitleField.name] && (
            <p className="text-sm text-muted-foreground">
              <FieldValue
                value={entry.fieldValues[subtitleField.name]}
                elementType={subtitleField.elementType}
                unit={subtitleField.unit}
                options={optionsWithLabels(subtitleField, entry)}
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
  )
}

/**
 * Everything else the row answers.
 *
 * ⚠️ **`omitFields` is how a fact stays in one place on the page.** A quantity read once in a stock
 * panel and again three cells later is two answers to one question, and the moment the two are
 * formatted differently somebody has to work out which is the record. The page that surfaced the field
 * elsewhere is the one that knows to take it out of here.
 */
export function EntryDetailsList({
  form,
  entry,
  dense = false,
  collapseBlanks = false,
  omitFields,
  heading = "Details",
  variant = "section",
}: {
  form: FormDetail
  entry: FormEntry
  dense?: boolean
  collapseBlanks?: boolean
  omitFields?: string[]
  heading?: string | null
  /**
   * A heading above a bordered grid, or a panel like the ones beside it.
   *
   * ⚠️ **`panel` exists so the column reads as one kind of thing.** Stock, Supply and Datasheet are
   * cards with their title inside them; a details grid under a bare uppercase word is a fourth shape in
   * a column of three, and the eye reads the odd one out as something that failed to load.
   */
  variant?: "section" | "panel"
}) {
  const configs = readFormConfigs(form.config)
  const byName = new Map(form.fields.map((field) => [field.name, field]))
  const fieldAt = (name: string | null) => (name ? byName.get(name) : undefined)

  const imageField = fieldAt(configs.imageField)
  const titleField = fieldAt(configs.primaryField) ?? form.fields[0]
  const subtitleField = fieldAt(configs.secondaryField)

  const highlightedNames = new Set(
    configs.priorityFields.filter((name) => name !== imageField?.name),
  )
  const shownAbove = new Set(
    [titleField?.name, subtitleField?.name, imageField?.name].filter((name): name is string => !!name),
  )
  const claimed = new Set(omitFields ?? [])

  const rest = form.fields.filter(
    (field) =>
      !highlightedNames.has(field.name) &&
      !shownAbove.has(field.name) &&
      !claimed.has(field.name) &&
      field.usageType !== "EMBEDDABLE",
  )

  /* ⚠️ A composite is answered by its CHILDREN, so a parent whose own slot is empty is not a blank —
     it is the one field on the form whose value lives somewhere else, and filing it under "nobody
     filled this in" would hide a filled resistance behind a disclosure triangle. */
  const isAnswered = (field: FieldDetail) =>
    !!entry.fieldValues[field.name] || (field.children ?? []).some((child) => !!entry.fieldValues[child.name])

  const answered = collapseBlanks ? rest.filter(isAnswered) : rest
  const blank = collapseBlanks ? rest.filter((field) => !isAnswered(field)) : []

  if (answered.length === 0 && blank.length === 0) {
    return null
  }

  /* ⚠️ **Counted and named, never silently dropped.** The line says how many there are, so a form with
     nothing filled in still reads as a form with fields rather than as a form with none. */
  const blanks = blank.length > 0 && (
    <details className="rounded-lg border border-dashed">
      <summary className="cursor-pointer list-none px-3 py-2 text-xs text-muted-foreground marker:content-none">
        <span className="font-medium text-foreground">{blank.length}</span> more field
        {blank.length === 1 ? "" : "s"} this type has, and nobody has filled in
      </summary>

      <FactGrid form={form} entry={entry} fields={blank} dense={dense} framed={false} />
    </details>
  )

  if (variant === "panel") {
    return (
      <EntryPanel title={heading ?? "Details"}>
        {/* ⚠️ Unframed: the panel already draws the border, and a box inside a box reads as a mistake.
            The hairlines between the rows are the grid's own and stay. */}
        {answered.length > 0 && (
          <FactGrid form={form} entry={entry} fields={answered} dense={dense} framed={false} />
        )}
        {blanks}
      </EntryPanel>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {answered.length > 0 && (
        <section className="flex flex-col gap-2">
          {heading && (
            <h3 className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              {heading}
            </h3>
          )}
          <FactGrid form={form} entry={entry} fields={answered} dense={dense} />
        </section>
      )}

      {blanks}
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
  framed = true,
}: {
  form: FormDetail
  entry: FormEntry
  fields: FieldDetail[]
  dense?: boolean
  emphasised?: boolean
  /** Off when something around it already draws a border — a box inside a box reads as a mistake. */
  framed?: boolean
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
        emphasised ? "border-t" : framed && "overflow-hidden rounded-lg border",
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

            {/* ⚠️ **The dense value WRAPS, it does not truncate.** A one-column list is narrow by
                design, so truncation there is not an edge case — it cut "Through-hole (THT)" to
                "Through-hole (TH…" and a manufacturer to three letters on the ordinary record. A row
                two lines tall is worth more than a value nobody can read. The wide grid keeps
                truncating: its cells are a third of the page and a long note there would set the row
                height for every cell beside it. */}
            <span
              className={cn(
                "min-w-0",
                dense ? "flex-1 text-right text-sm break-words" : "truncate text-sm",
                emphasised && (dense ? "font-semibold" : "text-base font-semibold"),
              )}
            >
              <FieldValue
                value={stored}
                elementType={field.elementType}
                unit={field.unit}
                options={optionsWithLabels(field, entry)}
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

