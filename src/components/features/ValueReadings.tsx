import { useRef, type RefObject } from "react"
import { Badge, Button, cn } from "@jmouse/ui"
import { useCopyFeedback } from "@/hooks/useCopyFeedback"
import { BAND_COLORS } from "./resistorBands"
import type { StandardNeighbour, ValueReading, ValueSpelling } from "@/api/parametric"

/**
 * Everything the backend made of some written text.
 *
 * ⚠️ **Presentational and nothing else.** It takes readings and knows nothing about where they came
 * from — no fetching, no input, no page state. The value-forms panel and the code-converter tool both
 * mount it, so a layout fault has one place to be fixed and a spelling can never look one way in one and
 * another way in the other.
 */
export function ValueReadings({
  readings,
  onSearchReading,
}: {
  readings: ValueReading[]
  /**
   * ⚠️ **Offered once per *reading*, never per spelling.** Every spelling of a reading is the same value
   * written differently; a button beside each one would suggest they search differently.
   */
  onSearchReading?: (reading: ValueReading) => void
}) {
  if (readings.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-4">
      {readings.map((reading, index) => (
        <ReadingBlock
          key={`${reading.route}-${index}`}
          reading={reading}
          onSearch={onSearchReading ? () => onSearchReading(reading) : undefined}
        />
      ))}
    </div>
  )
}

/**
 * ⚠️ **Lives here rather than on each screen, because three surfaces have to say it.** Written three
 * times it would be said in three voices, and this is the sentence that teaches somebody how to write a
 * value at all.
 */
export function UnreadableValueNotice({ value }: { value: string }) {
  return (
    <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
      “{value}” is not a value this can read — write it the way it is said, like <code className="font-mono">4.7</code>,{" "}
      <code className="font-mono">3k3</code> or <code className="font-mono">10nF</code>.
    </p>
  )
}

const STATES: Record<ValueSpelling["state"], { label: string; className: string }> = {
  EXACT: { label: "Exact", className: "text-emerald-600 dark:text-emerald-400" },
  APPROXIMATE: { label: "Approximate", className: "text-amber-600 dark:text-amber-400" },
  NOT_EXPRESSIBLE: { label: "Not expressible", className: "text-muted-foreground" },
}

/** The two families whose text is a sequence of colour names, and therefore a picture. */
const COLOUR_FAMILIES = ["COLOUR_FOUR_BAND", "COLOUR_FIVE_BAND"]

/**
 * One interpretation: what it means, every way that value is written, and the standard values near it.
 *
 * ⚠️ `332` renders four of these — in the order the API returned them, the bare number first.
 */
function ReadingBlock({ reading, onSearch }: { reading: ValueReading; onSearch?: () => void }) {
  const neighboursRef = useRef<HTMLElement | null>(null)

  // ⚠️ "Out of this code's multiplier range" is only actionable beside a notation that *does* hold the
  // value, and R-notation nearly always does. Without it the reason stands alone, which is still honest.
  const rNotation = reading.spellings.find(
    (spelling) => spelling.family === "R_NOTATION" && spelling.state !== "NOT_EXPRESSIBLE",
  )

  const hasNeighbours = reading.standardNeighbours.length > 0

  return (
    <section className="flex flex-col gap-2 rounded-md border p-3">
      <header className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{reading.routeLabel}</Badge>
        <span className="font-mono text-sm font-medium">{reading.value.normalizedDisplay ?? reading.input}</span>
        {onSearch && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onSearch}>
            Search my inventory for this
          </Button>
        )}
      </header>

      {reading.spellings.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-[10px] tracking-[0.05em] text-muted-foreground uppercase">
                <th className="w-40 py-1 pr-2 text-left font-medium">Form</th>
                <th className="py-1 pr-2 text-left font-medium">Written as</th>
                <th className="w-32 py-1 pr-2 text-left font-medium">State</th>
                <th className="py-1 text-left font-medium">Reads back as</th>
              </tr>
            </thead>

            <tbody>
              {reading.spellings.map((spelling, index) => (
                <SpellingRow
                  key={`${spelling.family}-${index}`}
                  spelling={spelling}
                  rNotation={rNotation?.text ?? null}
                  onShowNeighbours={
                    hasNeighbours
                      ? () => neighboursRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                      : undefined
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasNeighbours && <NeighboursSection neighbours={reading.standardNeighbours} sectionRef={neighboursRef} />}
    </section>
  )
}

function SpellingRow({
  spelling,
  rNotation,
  onShowNeighbours,
}: {
  spelling: ValueSpelling
  rNotation: string | null
  onShowNeighbours?: () => void
}) {
  const { copied, copy } = useCopyFeedback()

  const state = STATES[spelling.state]
  const isColour = COLOUR_FAMILIES.includes(spelling.family) && spelling.text !== null

  return (
    <tr className={cn("border-b last:border-b-0", spelling.reason === "NO_STANDARD_FOR_DIMENSION" && "opacity-50")}>
      <td className="py-1 pr-2 text-muted-foreground">{spelling.familyLabel}</td>

      <td className="py-1 pr-2">
        {spelling.text === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="group/spelling flex flex-wrap items-center gap-2">
            {isColour ? <ColourBands names={splitColours(spelling.text)} /> : <span className="font-mono">{spelling.text}</span>}
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 transition-opacity group-hover/spelling:opacity-100"
              title={`Copy “${clipboardTextFor(spelling)}”`}
              onClick={() => copy(clipboardTextFor(spelling))}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </span>
        )}
      </td>

      <td className={cn("py-1 pr-2", state.className)}>{state.label}</td>

      <td className="py-1">
        <ReadsBack spelling={spelling} rNotation={rNotation} onShowNeighbours={onShowNeighbours} />
      </td>
    </tr>
  )
}

/**
 * ⚠️ **What the row is really about: the value a marking turns back into.** An approximate spelling
 * states it here, in the row — not behind a tooltip nobody hovers before ordering a reel.
 */
function ReadsBack({
  spelling,
  rNotation,
  onShowNeighbours,
}: {
  spelling: ValueSpelling
  rNotation: string | null
  onShowNeighbours?: () => void
}) {
  if (spelling.state === "EXACT") {
    return <span className="text-muted-foreground">the value itself</span>
  }

  if (spelling.state === "APPROXIMATE") {
    return (
      <span className="flex flex-wrap items-baseline gap-1.5">
        <span className="text-muted-foreground">→</span>
        <span className="font-mono">{spelling.readsBackDisplay}</span>
        {spelling.deviationPercent !== null && (
          <span className="text-amber-600 dark:text-amber-400">({signedPercent(spelling.deviationPercent)})</span>
        )}
      </span>
    )
  }

  return (
    <span className="flex flex-col gap-0.5 text-muted-foreground">
      <span>{spelling.reasonLabel}</span>

      {spelling.reason === "OUT_OF_MULTIPLIER_RANGE" && rNotation && (
        <span className="text-[11px]">
          R-notation holds it: <span className="font-mono">{rNotation}</span>
        </span>
      )}

      {spelling.reason === "NOT_ON_REQUIRED_GRID" && onShowNeighbours && (
        <button type="button" className="self-start text-[11px] text-primary hover:underline" onClick={onShowNeighbours}>
          see the standard values nearby ↓
        </button>
      )}
    </span>
  )
}

/**
 * ⚠️ **A section of its own, never rows in the spellings table.** `3.3 kΩ` and `3k3` are one value
 * written twice; `3.6 kΩ` is a different resistor, and a table holding both is an invitation to copy the
 * second while believing it is the first.
 */
function NeighboursSection({
  neighbours,
  sectionRef,
}: {
  neighbours: StandardNeighbour[]
  sectionRef: RefObject<HTMLElement | null>
}) {
  return (
    <section ref={sectionRef} className="flex flex-col gap-1.5 border-t pt-2">
      <span className="text-[11px]">
        Standard values nearby
        <span className="text-muted-foreground"> — different values, not other ways of writing this one</span>
      </span>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-4">
        {neighbours.map((neighbour) => (
          <div
            key={neighbour.series}
            className={cn(
              "flex flex-col gap-0.5 rounded-md border p-2 text-[11px]",
              neighbour.member && "border-primary/50 bg-primary/5",
            )}
          >
            <span className="font-mono font-medium">{neighbour.series}</span>

            {neighbour.member ? (
              <span className="text-muted-foreground">on this grid</span>
            ) : (
              <span className="text-muted-foreground">
                nearest <span className="font-mono">{neighbour.nearestDisplay}</span>
                {neighbour.deviationPercent !== null && ` (${signedPercent(neighbour.deviationPercent)})`}
              </span>
            )}

            <span className="text-muted-foreground">usually ±{neighbour.conventionalTolerancePercent}%</span>
          </div>
        ))}
      </div>
    </section>
  )
}

/** ⚠️ Digit to colour is a picture, and pictures belong where the pixels are. */
function ColourBands({ names }: { names: string[] }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className="flex overflow-hidden rounded-sm border">
        {names.map((name, index) => (
          <span
            key={`${name}-${index}`}
            className="h-4 w-2.5"
            style={{ background: hexFor(name) }}
            title={name}
          />
        ))}
      </span>
      <span className="text-muted-foreground">{names.join(", ")}</span>
    </span>
  )
}

function splitColours(text: string): string[] {
  return text
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
}

function hexFor(name: string): string {
  return BAND_COLORS.find((band) => band.name.toLowerCase() === name.toLowerCase())?.hex ?? "transparent"
}

/**
 * ⚠️ **A spelling is copied together with what it means.** A bare `472` on the clipboard leaves the
 * −1.05 % behind on the one screen where it was no longer needed — the warning has to travel with the
 * marking into the order form or the chat window.
 */
function clipboardTextFor(spelling: ValueSpelling): string {
  if (spelling.text === null) {
    return ""
  }

  if (spelling.state !== "APPROXIMATE" || !spelling.readsBackDisplay) {
    return spelling.text
  }

  const deviation = spelling.deviationPercent === null ? "" : `, ${signedPercent(spelling.deviationPercent)}`

  return `${spelling.text} (reads back as ${spelling.readsBackDisplay}${deviation})`
}

function signedPercent(percent: number): string {
  return `${percent > 0 ? "+" : ""}${percent}%`
}
