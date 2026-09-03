import { useState } from "react"
import { Badge, Button, Skeleton, cn } from "@jmouse/ui"
import { useMovementsOf } from "@/hooks/useStock"
import { relativeTime } from "@/lib/dates"
import type { Movement, MovementReason, MovementSource } from "@/api/stock"

/**
 * What each reason is called, and how it reads.
 *
 * ⚠️ **The reason is the whole value of the journal.** "Twelve fewer" is arithmetic anybody could have
 * worked out from two numbers; "twelve issued to the charger project" is the thing somebody comes back
 * for six months later.
 */
const REASONS: Record<MovementReason, { label: string; tone: string }> = {
  RECEIPT: { label: "Received", tone: "text-emerald-600 dark:text-emerald-400" },
  ISSUE: { label: "Issued", tone: "text-amber-600 dark:text-amber-400" },
  WRITE_OFF: { label: "Written off", tone: "text-destructive" },
  COUNT: { label: "Counted", tone: "text-muted-foreground" },
  EDIT: { label: "Corrected", tone: "text-muted-foreground" },
}

/** Where a movement came from. ⚠️ Provenance, never permission — see the backend's own note. */
const SOURCES: Record<MovementSource, string> = {
  WEB: "in the browser",
  STATION: "at a station",
  LOOKUP: "from a price lookup",
  IMPORT: "by an import",
  MCP: "by an agent",
}

/**
 * Everything that ever happened to one shelf's quantity.
 *
 * <h2>⚠️ Why a record with a number needs this at all</h2>
 *
 * The quantity is not a value somebody typed — it is the sum of every movement in this list, and the
 * only way it changes. Without the list the number is unexplainable: nobody can tell a delivery from a
 * correction, or find out who took thirty of something on a Thursday.
 *
 * ⚠️ **Newest first, and the running total is NOT shown.** A balance after each movement would be one
 * more number to keep in step with the shelf, and it would go wrong the first time somebody looked at
 * page two — where the running total of a page is the running total of nothing.
 */
export function MovementsPane({ entryId }: { entryId: string }) {
  const [page, setPage] = useState(0)
  const query = useMovementsOf(entryId, page)

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  const movements = query.data?.content ?? []

  if (movements.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
        Nothing has moved yet. Every change to the quantity is recorded here with its reason — including
        the opening balance, when there is one.
      </p>
    )
  }

  const last = (query.data?.totalPages ?? 1) - 1

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="min-w-0 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-[10px] tracking-[0.06em] text-muted-foreground uppercase">
              <th className="px-2.5 py-1.5 text-right font-medium">Change</th>
              <th className="px-2.5 py-1.5 text-left font-medium">Why</th>
              <th className="px-2.5 py-1.5 text-left font-medium">Note</th>
              <th className="px-2.5 py-1.5 text-left font-medium">Who</th>
              <th className="px-2.5 py-1.5 text-left font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((movement) => (
              <MovementRow key={movement.id} movement={movement} />
            ))}
          </tbody>
        </table>
      </div>

      {last > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Newer
          </Button>
          <span className="tabular-nums">
            {page + 1} / {last + 1}
          </span>
          <Button variant="ghost" size="sm" disabled={page >= last} onClick={() => setPage(page + 1)}>
            Older
          </Button>
        </div>
      )}
    </div>
  )
}

function MovementRow({ movement }: { movement: Movement }) {
  const reason = REASONS[movement.reason]

  return (
    <tr className="border-b last:border-b-0">
      {/* ⚠️ Signed, monospaced and never abbreviated. The sign is the whole content of the row. */}
      <td className={cn("px-2.5 py-1.5 text-right font-mono font-medium tabular-nums", reason.tone)}>
        {movement.delta > 0 ? `+${movement.delta}` : movement.delta}
      </td>

      <td className="px-2.5 py-1.5">
        <span className="flex items-center gap-1.5">
          {reason.label}
          {/* ⚠️ Only where it says something. A movement recorded in the browser is the ordinary case,
              and a badge on every row would make the station and the agent rows stop standing out. */}
          {movement.source !== "WEB" && (
            <Badge variant="outline" className="text-[10px]">
              {SOURCES[movement.source]}
            </Badge>
          )}
        </span>
      </td>

      <td className="max-w-80 truncate px-2.5 py-1.5 text-muted-foreground">{movement.note ?? "—"}</td>

      <td className="px-2.5 py-1.5 text-xs text-muted-foreground">{movement.byUserName ?? "—"}</td>

      <td className="px-2.5 py-1.5 text-xs text-muted-foreground" title={movement.occurredAt}>
        {relativeTime(movement.occurredAt)}
      </td>
    </tr>
  )
}
