import { useState } from "react"
import { toast } from "sonner"
import { Badge, Button, Row, RowGroup, RowList, RowMeta, RowTitle, Skeleton, Textarea } from "@jmouse/ui"
import { useCompleteMaintenance, useDueState, useMaintenanceEvents } from "@/hooks/useMonitoring"
import { readableMoment } from "@/lib/dates"
import type { DueAnswer, DueState } from "@/api/monitoring"

/**
 * ⚠️ **Ordered by concern, not alphabetically.** `OUT_OF_RANGE` outranks `OVERDUE` because a fridge at
 * 9 °C is a problem this morning while a service three days late is a problem this week.
 */
const BADGES: Record<DueState, { label: string; variant: "default" | "destructive" | "outline" } | null> = {
  OK: null,
  STALE: { label: "no readings", variant: "outline" },
  DUE_SOON: { label: "due soon", variant: "default" },
  OVERDUE: { label: "overdue", variant: "destructive" },
  OUT_OF_RANGE: { label: "out of range", variant: "destructive" },
}

/**
 * What the rules say about this thing, and what has been done to it.
 *
 * ⚠️ **Nothing on this screen is stored anywhere.** Every due state is computed on the request from the
 * readings, the rules and the completed services. There is no `next_due` column to be stale, and if
 * this ever gets slow the answer is a read projection — never a status column, which cannot be told
 * apart from the truth once it has drifted.
 *
 * ⚠️ **Every answer shows the numbers that produced it.** "Overdue" a person cannot check is a claim;
 * *overdue by 43 h — due at 1 450 h, now at 1 493 h* is information. The explanation comes from the
 * backend so the browser never re-does the arithmetic and disagrees with it.
 */
export function AssetMaintenance({ assetId }: { assetId: string }) {
  const { data: due = [], isLoading } = useDueState(assetId)
  const { data: events = [] } = useMaintenanceEvents(assetId)

  const [completing, setCompleting] = useState<DueAnswer | null>(null)

  const notable = due.filter((answer) => answer.state !== "OK")

  if (isLoading) {
    return <Skeleton className="h-20 w-full" />
  }

  if (due.length === 0) {
    return null
  }

  return (
    <RowGroup label="What is due" tally={notable.length > 0 ? `${notable.length}` : "clear"}>
      <RowList>
        {due.map((answer) => {
          const badge = BADGES[answer.state]

          return (
            <Row
              key={answer.planId}
              trailing={
                <div className="flex items-center gap-2">
                  {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
                  <Button type="button" size="sm" variant="outline" onClick={() => setCompleting(answer)}>
                    Done
                  </Button>
                </div>
              }
            >
              <RowTitle>{answer.planName}</RowTitle>
              <RowMeta>{answer.explanation}</RowMeta>
              {answer.lastPerformedAt && (
                <RowMeta>Last carried out {readableMoment(answer.lastPerformedAt)}</RowMeta>
              )}
            </Row>
          )
        })}
      </RowList>

      {completing && (
        <CompleteForm assetId={assetId} answer={completing} onDone={() => setCompleting(null)} />
      )}

      {events.length > 0 && (
        <details className="rounded-md border px-3 py-2">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            {events.length} service{events.length === 1 ? "" : "s"} on record
          </summary>

          <ul className="mt-2 flex flex-col gap-1">
            {events.map((event) => (
              <li key={event.id} className="flex items-baseline gap-2 text-xs">
                <span>{readableMoment(event.performedAt)}</span>
                {event.readingValue && (
                  // ⚠️ The frozen number, and it is worth showing: it is the origin of the next
                  // interval, and a later correction of the reading does not move it.
                  <span className="font-mono text-muted-foreground">at {event.readingValue}</span>
                )}
                {event.note && <span className="truncate text-muted-foreground">— {event.note}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </RowGroup>
  )
}

/**
 * ⚠️ **Completing freezes the reading current at this moment.** The form says so, because it is the one
 * thing about this action that is not obvious and cannot be undone by correcting a number later.
 */
function CompleteForm({
  assetId,
  answer,
  onDone,
}: {
  assetId: string
  answer: DueAnswer
  onDone: () => void
}) {
  const complete = useCompleteMaintenance()
  const [note, setNote] = useState("")

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <p className="text-xs">
        Recording <strong>{answer.planName}</strong> as carried out.
        {answer.currentValue && (
          <>
            {" "}
            The current reading of <strong>{answer.metricName}</strong> — {answer.currentValue}
            {answer.metricUnit ? ` ${answer.metricUnit}` : ""} — is written down with it, and stays as it
            is even if that reading is corrected later. It is where the next interval counts from.
          </>
        )}
      </p>

      <Textarea rows={2} placeholder="What was done" value={note} onChange={(event) => setNote(event.target.value)} />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={complete.isPending}
          onClick={() =>
            complete.mutate(
              { assetId, payload: { planId: answer.planId, note: note.trim() || null } },
              {
                onSuccess: onDone,
                onError: () => toast.error("That was not recorded."),
              },
            )
          }
        >
          Record it
        </Button>
      </div>
    </div>
  )
}
