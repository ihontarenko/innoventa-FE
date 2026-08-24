import { useState } from "react"
import { toast } from "sonner"
import { Badge, Button, Input, Skeleton, cn } from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { ToggleChip } from "@/components/ToggleChip"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { EntryDetailDrawer } from "@/components/form/EntryDetailDrawer"
import { ValueFormsDialog } from "@/components/features/ValueFormsDialog"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import {
  READING_DEBOUNCE_MILLISECONDS,
  useParametricSearch,
  useValueDimensions,
  useValueReadings,
} from "@/hooks/useParametric"
import { useEntry, useUpdateEntry } from "@/hooks/useWorkspaceForms"
import { normalizeValueForUI } from "@/lib/fieldValues"
import type { ValueReading } from "@/api/parametric"

/** Standard component tolerances, mirroring the real E-series grades a part is sold at. */
const TOLERANCES = [1, 2, 5, 10, 20]

/** ±10% — the E24 grid — is the band matched without asking. */
const DEFAULT_TOLERANCE = 10

/** What a reading reports when the text named no dimension. ⚠️ Not a dimension one can search within. */
const NO_DIMENSION = "UNKNOWN"

/**
 * Finding what you own by *value* rather than by name.
 *
 * ⚠️ **100 nF and 0.1 µF are the same part.** Values are normalised to a base unit when they are saved,
 * so the search is over numbers rather than over spellings — which is the whole reason this screen is
 * not the ordinary search.
 *
 * ⚠️ **The echo under the box is the feature, not decoration.** `3k3` and `33k` are one keystroke apart
 * and mean very different resistors; seeing `3.3 kΩ` before pressing Search is what stops somebody
 * searching for the wrong decade and concluding they own nothing.
 *
 * ⚠️ **A dimension in the text locks the picker, and clearing the unit unlocks it.** The server reads
 * the dimension out of the magnitude, so sending a second opinion alongside is the only way the two
 * could ever disagree — and a control that stayed overwritten after its cause was gone would be worse
 * than one that never moved.
 */
export function ParametricSearchPage() {
  const [typed, setTyped] = useState("")
  const [isValueFormsOpen, setValueFormsOpen] = useState(false)
  const [chosenDimension, setChosenDimension] = useState("")
  const [tolerance, setTolerance] = useState(DEFAULT_TOLERANCE)
  const [search, setSearch] = useState<{ magnitude: string; dimension: string } | null>(null)
  const [openEntry, setOpenEntry] = useState<{ formId: string; entryId: string } | null>(null)

  const value = typed.trim()
  const settled = useDebouncedValue(value, READING_DEBOUNCE_MILLISECONDS)

  const { data: dimensions = [] } = useValueDimensions()
  const { data: readings, isFetching: isReading } = useValueReadings(settled, settled.length > 0)

  const firstReading = readings?.[0]
  const isSettled = settled === value && !isReading
  const detectedDimension = isSettled && firstReading && firstReading.value.kind !== NO_DIMENSION ? firstReading.value.kind : ""

  const isLocked = detectedDimension !== ""
  const shownDimension = isLocked ? detectedDimension : chosenDimension

  const { data, isFetching } = useParametricSearch(
    search?.magnitude ?? "",
    search?.dimension ?? "",
    tolerance,
    Boolean(search?.magnitude),
  )

  // Only a chosen dimension can contradict a reading, so the wait never shows without one.
  const isAwaitingReading = chosenDimension !== "" && !isSettled

  const readingDimensionLabel = dimensions.find((one) => one.code === firstReading?.value.kind)?.label
  const chosenDimensionLabel = dimensions.find((one) => one.code === chosenDimension)?.label

  const isUnreadable = settled.length > 0 && readings !== undefined && readings.length === 0
  const isBandCurrent = search?.magnitude === value

  /**
   * ⚠️ Takes the search over to one reading — the dimension comes from the reading itself, not from
   * whatever the picker happened to be showing, or a resistor code would be searched as a capacitance.
   */
  function searchForReading(reading: ValueReading) {
    // ⚠️ The value the SERVER normalised, falling back to what was typed — never a number this screen
    // worked out. There is one interpreter of written values and it is the backend (ADR-0009).
    const magnitude = reading.value.normalizedDisplay ?? reading.value.input

    setTyped(magnitude)
    setChosenDimension(reading.value.kind)
    setSearch({ magnitude, dimension: reading.value.kind })
  }

  function run() {
    if (!value || isAwaitingReading) {
      return
    }

    setSearch({ magnitude: value, dimension: isLocked ? "" : chosenDimension })
  }

  return (
    <>
      <PageHeader
        title="Parametric search"
        description="Find what you own by value — 100 nF and 0.1 µF match the same part, because values are normalised to a base unit when they are saved"
      />

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
          <label className="flex min-w-56 flex-1 flex-col gap-1">
            <span className="text-xs font-medium">Value</span>
            <Input
              autoFocus
              className="h-8 font-mono text-sm"
              value={typed}
              placeholder="4.7 · 3300 · 3.3k · 3k3 · 10nF"
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && run()}
            />
          </label>

          <label className="flex w-44 flex-col gap-1">
            <span className="text-xs font-medium">Dimension</span>
            <PlainSelect value={shownDimension} disabled={isLocked} onChange={setChosenDimension}>
              <option value="">Any</option>
              {dimensions.map((dimension) => (
                <option key={dimension.code} value={dimension.code}>
                  {dimension.label}
                </option>
              ))}
            </PlainSelect>
          </label>

          <label className="flex w-28 flex-col gap-1">
            <span className="text-xs font-medium">Tolerance</span>
            <PlainSelect value={String(tolerance)} onChange={(next) => setTolerance(Number(next))}>
              {TOLERANCES.map((percent) => (
                <option key={percent} value={percent}>
                  ±{percent}%
                </option>
              ))}
            </PlainSelect>
          </label>

          <Button size="sm" disabled={!value || isAwaitingReading} onClick={run}>
            Search
          </Button>

          {/* ⚠️ A different question from filtering, which is why it is a second button rather than a
              panel. The field can act on ONE interpretation at a time, and `332` is a number and also
              three different component codes — choosing between them is what this opens, and it hands
              the chosen one back to the search. */}
          <Button size="sm" variant="outline" onClick={() => setValueFormsOpen(true)}>
            Value forms
          </Button>

          {isLocked && (
            <p className="w-full text-[11px] text-muted-foreground">
              The dimension came from the value you typed. Remove the unit to choose it yourself.
            </p>
          )}
        </div>

        {firstReading && (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
            <span className="font-mono font-medium">{firstReading.value.normalizedDisplay}</span>

            {readingDimensionLabel ? (
              <Badge variant="secondary">{readingDimensionLabel}</Badge>
            ) : (
              <span className="text-xs text-muted-foreground">
                {chosenDimensionLabel
                  ? `no unit in the text — narrowed to ${chosenDimensionLabel.toLowerCase()}`
                  : "no unit — every dimension"}
              </span>
            )}

            {/* ⚠️ The band belongs to the search that was *run*, not to the text being typed now. */}
            {isBandCurrent && data?.bandLowDisplay && data.bandHighDisplay && (
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {data.bandLowDisplay} – {data.bandHighDisplay}
              </span>
            )}
          </div>
        )}

        {isUnreadable && (
          <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
            <span className="font-mono">{settled}</span> is not a value this can read. Try a number, a number with a
            unit, or a component code — <span className="font-mono">4.7</span>,{" "}
            <span className="font-mono">3.3kΩ</span>, <span className="font-mono">332</span>.
          </p>
        )}

        {data && data.eSeriesE24.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">E24 standard values in range:</span>
            {data.eSeriesE24.map((suggestion) => (
              <ToggleChip key={suggestion.value} active onClick={() => undefined}>
                {suggestion.display}
              </ToggleChip>
            ))}
          </div>
        )}

        {isFetching ? (
          <Skeleton className="h-48 w-full" />
        ) : !search ? (
          <Hint
            title="Search what you hold by value"
            detail="Type a value above. However it was written when it was saved, it matches — the number is what is compared."
          />
        ) : data && data.matches.length === 0 ? (
          <Hint
            title="Nothing in that band"
            detail="No stored value fell inside the tolerance. Widen it, or check that the field holding these values is a composite — a number and a unit — rather than plain text."
          />
        ) : data ? (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-[10px] tracking-[0.06em] text-muted-foreground uppercase">
                  <th className="px-2.5 py-1.5 text-left font-medium">Value</th>
                  <th className="w-24 px-2.5 py-1.5 text-left font-medium">Deviation</th>
                  <th className="px-2.5 py-1.5 text-left font-medium">Component</th>
                  <th className="px-2.5 py-1.5 text-left font-medium">Type</th>
                  <th className="px-2.5 py-1.5 text-left font-medium">Field</th>
                </tr>
              </thead>

              <tbody>
                {data.matches.map((match) => {
                  const primary = match.normalizedDisplay ?? match.textValue
                  // The stored spelling, but only when it says something the normalised one does not —
                  // showing "1000 Ω" twice on one row teaches nobody anything.
                  const stored = match.textValue ? normalizeValueForUI(match.textValue) : ""
                  const showsStored = stored !== "" && stored !== primary

                  return (
                    <tr
                      key={`${match.entryId}-${match.fieldName}`}
                      className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-accent"
                      onClick={() => setOpenEntry({ formId: match.formId, entryId: match.entryId })}
                    >
                      <td className="px-2.5 py-1.5">
                        <span className="font-mono font-medium">{primary}</span>
                        {showsStored && <span className="ml-2 text-xs text-muted-foreground">{stored}</span>}
                      </td>
                      <td className="px-2.5 py-1.5">
                        <span
                          className={cn(
                            "font-mono text-xs",
                            match.deviationPercent === 0 && "text-muted-foreground",
                            match.deviationPercent > 0 && "text-amber-600 dark:text-amber-400",
                            match.deviationPercent < 0 && "text-sky-600 dark:text-sky-400",
                          )}
                        >
                          {match.deviationPercent > 0 ? "+" : ""}
                          {match.deviationPercent}%
                        </span>
                      </td>
                      <td className="max-w-72 truncate px-2.5 py-1.5">{match.entryLabel}</td>
                      <td className="px-2.5 py-1.5 text-xs text-muted-foreground">{match.formName}</td>
                      <td className="px-2.5 py-1.5 text-xs text-muted-foreground">{match.fieldLabel}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {openEntry && (
        <MatchedEntryDrawer
          formId={openEntry.formId}
          entryId={openEntry.entryId}
          onClose={() => setOpenEntry(null)}
        />
      )}

      {/* ⚠️ Prefilled from the RAW text, not the normalised value: `3k3` opens as `3k3`. Filling in
          `3300` would drop the very spelling somebody started from — which is the one they opened this
          to compare against the others. */}
      {isValueFormsOpen && (
        <ValueFormsDialog
          initialValue={typed}
          onClose={() => setValueFormsOpen(false)}
          onSearchReading={searchForReading}
        />
      )}
    </>
  )
}

function Hint({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
      <span aria-hidden="true" className="text-2xl">
        ⌁
      </span>
      <span className="text-sm font-medium">{title}</span>
      <span className="max-w-md text-xs text-muted-foreground">{detail}</span>
    </div>
  )
}

/**
 * ⚠️ **The match carries an entry's id and nothing else about it**, so the row has to be fetched before
 * it can be read. A drawer over the results keeps the search on screen, which is the point of opening
 * a match at all — somebody is comparing four of them.
 */
function MatchedEntryDrawer({
  formId,
  entryId,
  onClose,
}: {
  formId: string
  entryId: string
  onClose: () => void
}) {
  const { data: entry } = useEntry(formId, entryId)
  const updateEntry = useUpdateEntry()

  return (
    <EntryDetailDrawer
      formId={formId}
      entry={entry}
      isSubmitting={updateEntry.isPending}
      onSubmit={async (fieldValues) => {
        await updateEntry.mutateAsync({ formId, entryId, fieldValues })
        toast.success("Saved.")
      }}
      onClose={onClose}
    />
  )
}

