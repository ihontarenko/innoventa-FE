import { useState } from "react"
import { Tabs, TabsList, TabsTrigger } from "@jmouse/ui"
import { CadAttachmentsPanel } from "@/components/cad/CadAttachmentsPanel"
import { EntryDocumentPane } from "@/components/entry/EntryDocumentPane"
import {
  EntryDatasheetGapPanel,
  EntryLinksList,
  EntryStockPanel,
  EntrySupplyPanel,
} from "@/components/entry/EntryRailPanels"
import { EntryRelatedPanel } from "@/components/entry/EntryRelatedPanel"
import { EntryDatasheetLinkView, EntryImageView } from "@/components/entry/EntryTabViews"
import { hasValue, readEntryCapabilities } from "@/components/entry/entryCapabilities"
import { EntryDetailsList, EntryIdentityCard } from "@/components/form/EntryRecord"
import { EntryWidgets } from "@/components/form/EntryWidgets"
import { readFormConfigs } from "@/lib/formConfigs"
import type { FormDetail, FormEntry } from "@/types"

/**
 * One record, read as a dossier — and the SAME dossier whichever purpose it is.
 *
 * ⚠️ **One page, three purposes, and it has to know the difference.** `INVENTORY`, `CATALOG` and `CAD`
 * are the same route and the same component. What separates them is not layout but *capability* — a
 * drawing has no datasheet and no price, only a shelf row has a quantity — and every panel and every tab
 * below is drawn from `readEntryCapabilities` rather than from a test written here. So the three read as
 * one screen with different things on it, never as three screens.
 *
 * The arrangement, and why it is this one:
 *
 * - **Identity across the top**, full width. What names the row and the specifications somebody opened
 *   it for are the one thing every purpose has.
 * - **Details down a column on the left, as a list.** A wide three-column grid of label-and-value is a
 *   wall of labels: nothing is near anything it relates to, and the eye has no line to follow.
 * - **Everything attached to the record in tabs beside it** — the document, the picture, the addresses,
 *   the drawings. Each is a thing to look at rather than a value to read, and giving it the width means
 *   it is *looked at* here instead of downloaded and looked at elsewhere.
 *
 * ⚠️ **Every field lands in exactly ONE place.** Whatever a panel or a tab takes over is claimed and
 * leaves the details list — a buy address read once beside the price and again under Links is two
 * answers to one question.
 *
 * ⚠️ **The document is never the tab that opens.** Somebody arriving at a record wants the record; a
 * 70svh PDF as the first thing on screen buries everything the page came to say.
 */
export function EntryDossier({
  form,
  entry,
  onLookUp,
}: {
  form: FormDetail
  entry: FormEntry
  /** Offered from the gaps, so an empty datasheet is one press from being filled. */
  onLookUp?: () => void
}) {
  const capabilities = readEntryCapabilities(form)
  const configs = readFormConfigs(form.config)

  const title = configs.primaryField ? (entry.fieldValues[configs.primaryField] ?? "") : ""

  /**
   * ⚠️ **A form that marks no priority fields still gets a band of specifications.** Otherwise one
   * purpose opens with a thumbnail and three figures and another opens with a bare title bar — and the
   * difference is a setting nobody made, not anything true about the record.
   *
   * Chosen here rather than inside the card because only this component knows what the panels have
   * already taken: picked from what is *unclaimed*, so a quantity can never appear in the strip and
   * again in the stock panel under it.
   */
  const claimed = new Set(capabilities.claimedFieldNames)
  const heroFallback =
    configs.priorityFields.length > 0
      ? []
      : form.fields
          .filter(
            (field) =>
              !claimed.has(field.name) &&
              field.usageType !== "EMBEDDABLE" &&
              field.usageType !== "PHANTOM" &&
              field.elementType !== "COMPLEX_COMPOSITE" &&
              field.elementType !== "NONE" &&
              !!entry.fieldValues[field.name],
          )
          .slice(0, 3)

  const hasDatasheetFile = hasValue(entry, capabilities.datasheet?.file)
  const hasDatasheetLink = hasValue(entry, capabilities.datasheet?.url)
  const pictures = capabilities.imageFields.filter((field) => hasValue(entry, field))

  /* ⚠️ Built from what the record CAN carry, so a drawing simply has no Datasheet tab — rather than a
     Datasheet tab that explains it will always be empty. The relations tab is first for every purpose,
     which is what makes the three pages recognisably one screen. */
  const tabs: Array<{ key: string; label: string; count?: number }> = [
    { key: "relations", label: "Related" },
  ]

  if (hasDatasheetFile) {
    tabs.push({ key: "datasheet", label: "Datasheet" })
  }

  if (hasDatasheetLink) {
    tabs.push({ key: "datasheet-link", label: "Datasheet link" })
  }

  if (pictures.length > 0) {
    tabs.push({ key: "image", label: pictures.length > 1 ? "Pictures" : "Picture", count: pictures.length })
  }

  if (capabilities.linkFields.length > 0) {
    tabs.push({
      key: "links",
      label: "Links",
      count: capabilities.linkFields.filter((field) => hasValue(entry, field)).length,
    })
  }

  const [tab, setTab] = useState(tabs[0].key)
  const current = tabs.some((one) => one.key === tab) ? tab : tabs[0].key

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <EntryIdentityCard form={form} entry={entry} highlightFallback={heroFallback} />

      {/* ⚠️ **Directly under the specifications it is a reading OF, and at full width.** A widget is the
          answers drawn — a resistance as colour bands, a quantity as a stock light — so it belongs
          against the band it explains rather than at the foot of a 26rem column where the bands would
          not fit across. Renders nothing at all for a form that carries no widget. */}
      <EntryWidgets formId={form.id} entry={entry} />

      <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          {capabilities.stock && <EntryStockPanel entry={entry} stock={capabilities.stock} />}

          {capabilities.supply && (
            <EntrySupplyPanel entry={entry} supply={capabilities.supply} onLookUp={onLookUp} />
          )}

          {/* ⚠️ The gap only. A datasheet that exists is read in its own tab; a panel about it here would
              be the third copy of one fact on one screen. */}
          {capabilities.datasheet && !hasDatasheetFile && !hasDatasheetLink && (
            <EntryDatasheetGapPanel onLookUp={onLookUp} />
          )}

          {/* ⚠️ `dense`, and it is not a size — it is the one-column arrangement. The measure here is
              26rem however wide the window is, so the responsive grid would fold three columns into one
              and leave every label stacked on its value. */}
          <EntryDetailsList
            form={form}
            entry={entry}
            dense
            variant="panel"
            collapseBlanks
            omitFields={[...capabilities.claimedFieldNames, ...heroFallback.map((field) => field.name)]}
          />

          {/* ⚠️ **The one sentence that keeps *absent* from reading as *empty*.** Without it a drawing
              with no price panel and a part whose price nobody typed look identical — and that
              difference is the whole reason this screen was rebuilt. */}
          {capabilities.absent.length > 0 && (
            <p className="rounded-lg border border-dashed px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
              This type does not carry {listOf(capabilities.absent)} — not left blank, but not something
              a {(capabilities.purposeCode ?? "record").toLowerCase()} record has.
            </p>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          {/* ⚠️ One tab is still a tab. A strip that appears only above two of them makes the same page
              two different shapes depending on what somebody happened to fill in. */}
          <Tabs value={current} onValueChange={setTab}>
            <TabsList>
              {tabs.map((one) => (
                <TabsTrigger key={one.key} value={one.key}>
                  {one.label}
                  {one.count !== undefined && one.count > 1 && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground tabular-nums">{one.count}</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {current === "relations" && (
            /* ⚠️ Both ends of the relation, from whichever end this record is. It is offered for every
               purpose deliberately — a bin with no drawing attached is exactly the row that needs one. */
            <div className="flex flex-col gap-5">
              <CadAttachmentsPanel
                entryId={entry.id}
                drawingKind={capabilities.isDrawing ? (entry.fieldValues?.cad_kind ?? null) : null}
                entryTitle={title || undefined}
              />

              <hr className="border-border" />

              {/* ⚠️ Beside the drawings rather than in a tab of its own: *what is this connected to* is
                  one question, and splitting it in two makes somebody check both places to answer it. */}
              <EntryRelatedPanel entry={entry} purposeCode={capabilities.purposeCode} />
            </div>
          )}

          {current === "datasheet" && capabilities.datasheet && (
            <EntryDocumentPane entry={entry} datasheet={capabilities.datasheet} />
          )}

          {current === "datasheet-link" && capabilities.datasheet?.url && (
            <EntryDatasheetLinkView entry={entry} field={capabilities.datasheet.url} />
          )}

          {current === "image" && <EntryImageView entry={entry} fields={capabilities.imageFields} />}

          {current === "links" && <EntryLinksList entry={entry} fields={capabilities.linkFields} />}
        </div>
      </div>
    </div>
  )
}

/** "a, b or c" — read as a sentence rather than as data. */
function listOf(items: string[]): string {
  if (items.length <= 1) {
    return items[0] ?? ""
  }

  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`
}
