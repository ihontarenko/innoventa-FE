import { Badge } from "@jmouse/ui"
import type { StocktakeStatus } from "@/api/stocktakes"

/**
 * What state a counting sheet is in.
 *
 * ⚠️ **The words are not the enum.** `OPEN` reads to somebody staffing a store as "you may still do
 * something to it", which is true of `COUNTING` as well; *Drawn* says the thing that is actually
 * distinct about it — the sheet exists and nobody has started walking it.
 *
 * ⚠️ **And the state is not carried by colour alone.** A closed sheet and a drawn one differ in the
 * word first; the tint only reinforces it.
 */
const WORDS: Record<StocktakeStatus, { label: string; tone: "muted" | "accent" | "done" }> = {
  OPEN: { label: "Drawn", tone: "muted" },
  COUNTING: { label: "Counting", tone: "accent" },
  CLOSED: { label: "Closed", tone: "done" },
}

export function StocktakeStatusBadge({ status }: { status: StocktakeStatus }) {
  const shown = WORDS[status]

  return (
    <Badge variant={shown.tone === "accent" ? "default" : "secondary"} className="font-normal">
      {shown.label}
    </Badge>
  )
}
