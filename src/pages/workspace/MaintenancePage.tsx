import { useState } from "react"
import { Badge, cn, Row, RowList, RowMeta, RowTitle, Skeleton } from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { ToggleChip } from "@/components/ToggleChip"
import { ViewBar } from "@/components/ViewBar"
import { AssetSheet } from "@/components/custody/AssetPanel"
import { LoadFailureNotice } from "@/components/LoadFailureNotice"
import { useAssetForms } from "@/hooks/useCustody"
import { useMaintenanceBoard, useMonitoringModule } from "@/hooks/useMonitoring"
import { useTerm } from "@/hooks/useTerminology"
import { useViewFromAddress } from "@/hooks/useViewFromAddress"
import { describeQueryFailure } from "@/lib/loadFailure"
import { relativeMoment } from "@/lib/dates"
import type { DueState, MaintenanceBoardEntry } from "@/api/monitoring"

/**
 * Servicing, asked of the whole workspace.
 *
 * ⚠️ **Not a second attention board.** Attention answers *what needs somebody today* and is blind to
 * which feature raised each item. This answers *the state of servicing* — including everything that is
 * perfectly fine, which is the one thing an attention board must never be asked to carry. They are the
 * same data at two urgencies, and merging them would put "nothing is wrong" on a board whose whole
 * purpose is that something is.
 *
 * ⚠️ **Nothing here is stored.** Every row is derived on read from the readings, the rules and the
 * service history; there is no `next_due` column and there must never be one — a stored due date is
 * wrong the moment a reading is corrected, and nothing would say so.
 *
 * ⚠️ **The rows lead to the thing, and the act happens there.** Recording a service is done in the
 * asset's own Maintenance tab, which owns the note, the frozen reading and the checklist. A second
 * "mark done" here would be a second implementation of the one action that freezes history.
 */
const STATES: Array<{ value: DueState; label: string; glyph: string }> = [
  { value: "OVERDUE", label: "Overdue", glyph: "!" },
  { value: "OUT_OF_RANGE", label: "Out of range", glyph: "≠" },
  { value: "DUE_SOON", label: "Due soon", glyph: "◔" },
  { value: "STALE", label: "No readings", glyph: "?" },
  { value: "OK", label: "Fine", glyph: "◉" },
]

export function MaintenancePage() {
  const watchesEquipment = useMonitoringModule()

  const [state, setState] = useState<DueState | undefined>(undefined)
  const [formId, setFormId] = useState<string | undefined>(undefined)
  const [openAssetId, setOpenAssetId] = useState<string | null>(null)
  const [activeViewId, setActiveViewId] = useState<string | null>(null)

  const query = useMaintenanceBoard({ state, formId })
  const failure = describeQueryFailure(query, "maintenance")

  const { data: assetForms = [] } = useAssetForms()

  const term = useTerm()
  const rules = term("rule.many", "rules")
  const things = term("thing.many", "things")

  const rows = query.data ?? []

  /**
   * ⚠️ **Narrowing by hand un-claims the view.** Once somebody adds a chip the filter is no longer what
   * the view stored, and a chip still showing itself as active would be the screen lying about which
   * question is on it.
   */
  function narrow(next: DueState | undefined) {
    setState(next)
    setActiveViewId(null)
  }

  function narrowKind(next: string | undefined) {
    setFormId(next)
    setActiveViewId(null)
  }

  // A pinned view in the menu links here carrying its id in the address — that is what makes it a
  // real menu item rather than a shortcut: shareable, survives a reload, and Back goes where expected.
  useViewFromAddress<{ state?: DueState; formId?: string }>("maintenance", (applied, viewId) => {
    setState(applied.state)
    setFormId(applied.formId)
    setActiveViewId(viewId)
  })

  if (failure) {
    return <LoadFailureNotice failure={failure} onRetry={() => void query.refetch()} />
  }

  return (
    <>
      <PageHeader
        title="Maintenance"
        description={`Every one of the ${rules} against the ${things} it governs — worst first`}
      />

      {!watchesEquipment ? (
        <ModuleOff />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <ViewBar
            section="maintenance"
            filter={{ state, formId }}
            isFiltered={Boolean(state || formId)}
            activeViewId={activeViewId}
            onApply={(applied, viewId) => {
              setState(applied.state)
              setFormId(applied.formId)
              setActiveViewId(viewId)
            }}
          />

          <div className="flex flex-wrap gap-1.5">
            <ToggleChip active={!state} onClick={() => narrow(undefined)}>
              Everything
            </ToggleChip>
            {STATES.map((candidate) => (
              <ToggleChip
                key={candidate.value}
                active={state === candidate.value}
                onClick={() => narrow(state === candidate.value ? undefined : candidate.value)}
              >
                {candidate.label}
              </ToggleChip>
            ))}

            {assetForms.length > 1 && (
              <span className="mx-1 self-center text-muted-foreground">·</span>
            )}
            {assetForms.length > 1 &&
              assetForms.map((form) => (
                <ToggleChip
                  key={form.id}
                  active={formId === form.id}
                  onClick={() => narrowKind(formId === form.id ? undefined : form.id)}
                >
                  {form.name}
                </ToggleChip>
              ))}
          </div>

          {query.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : rows.length === 0 ? (
            <NothingDue narrowed={Boolean(state || formId)} />
          ) : (
            <RowList>
              {rows.map((row) => (
                <MaintenanceRow
                  key={`${row.assetId}:${row.answer.planId}`}
                  row={row}
                  onOpen={() => setOpenAssetId(row.assetId)}
                />
              ))}
            </RowList>
          )}
        </div>
      )}

      {openAssetId && <AssetSheet assetId={openAssetId} onClose={() => setOpenAssetId(null)} />}
    </>
  )
}

/**
 * ⚠️ **The explanation is the row, not a tooltip on it.** The derivation composes one sentence carrying
 * the numbers that produced the answer — *overdue by 43 hours: last serviced at 1 200, now at 1 493,
 * every 250*. A red badge without it is a claim, and sends whoever doubts it to the database.
 */
function MaintenanceRow({ row, onOpen }: { row: MaintenanceBoardEntry; onOpen: () => void }) {
  const { answer } = row
  const alarming = answer.state === "OVERDUE" || answer.state === "OUT_OF_RANGE"

  return (
    <Row
      onOpen={onOpen}
      className={cn(alarming && "border-l-2 border-l-destructive bg-destructive/5")}
      leading={<span aria-hidden="true">{glyphOf(answer.state)}</span>}
      trailing={
        <>
          <Badge variant={badgeOf(answer.state)}>{labelOf(answer.state)}</Badge>
          {/* ⚠️ The one bit of behaviour a plan carries: its lapse takes the machine out of
              circulation. It outranks a rule of the same lateness that does not, so it is said. */}
          {answer.sendsToService && <Badge variant="outline">stops the thing</Badge>}
          {answer.dueAt && <Badge variant="secondary">{relativeMoment(answer.dueAt)}</Badge>}
        </>
      }
    >
      <RowTitle>
        {row.assetLabel} — {answer.planName}
      </RowTitle>
      <RowMeta>{answer.explanation}</RowMeta>
    </Row>
  )
}

function glyphOf(state: DueState) {
  return STATES.find((candidate) => candidate.value === state)?.glyph ?? "·"
}

function labelOf(state: DueState) {
  return STATES.find((candidate) => candidate.value === state)?.label ?? state
}

function badgeOf(state: DueState): "default" | "secondary" | "destructive" | "outline" {
  if (state === "OVERDUE" || state === "OUT_OF_RANGE") {
    return "destructive"
  }

  if (state === "DUE_SOON" || state === "STALE") {
    return "outline"
  }

  return "secondary"
}

/**
 * ⚠️ **Two empties, and they mean opposite things.** Narrowed to nothing is a filter answer. Nothing at
 * all means no rule governs anything here — which is a configuration state and says where to fix it,
 * rather than congratulating somebody on a fleet that is not being watched.
 */
function NothingDue({ narrowed }: { narrowed: boolean }) {
  if (narrowed) {
    return (
      <div className="rounded-md border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
        Nothing matches that.
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
      <span aria-hidden="true" className="text-2xl">
        ◔
      </span>
      <span className="text-sm font-medium">Nothing governs anything yet</span>
      <span className="max-w-md text-xs text-muted-foreground">
        A rule belongs to a class of things — "excavators are serviced every 250 motorhours" is one row
        over every excavator. The <strong>Watch</strong> screen is where they are written, and everything
        they say appears here.
      </span>
    </div>
  )
}

function ModuleOff() {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
      <span aria-hidden="true" className="text-2xl">
        ◔
      </span>
      <span className="text-sm font-medium">This workspace does not watch its things</span>
      <span className="max-w-md text-xs text-muted-foreground">
        Custody answers who holds a thing; the watch answers what state it is in. It is a module, and this
        workspace does not have it switched on.
      </span>
    </div>
  )
}
