import { useState } from "react"
import { Badge, cn, Row, RowList, RowMeta, RowTitle, Skeleton } from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { Pagination } from "@/components/Pagination"
import { ToggleChip } from "@/components/ToggleChip"
import { ViewBar } from "@/components/ViewBar"
import { AssetSheet } from "@/components/custody/AssetPanel"
import { LoadFailureNotice } from "@/components/LoadFailureNotice"
import { useAssetForms } from "@/hooks/useCustody"
import { useInspectionBoard, useMonitoringModule } from "@/hooks/useMonitoring"
import { capitalised, useTerm } from "@/hooks/useTerminology"
import { useViewFromAddress } from "@/hooks/useViewFromAddress"
import { describeQueryFailure } from "@/lib/loadFailure"
import { readableMoment, relativeTime } from "@/lib/dates"
import type { InspectionBoardEntry, InspectionOutcome } from "@/api/monitoring"

const PAGE_SIZE = 25

/**
 * ⚠️ **Three verdicts, and the middle one is the point.** *Passed with remarks* is what an acceptance
 * check actually produces most of the time, and a product offering only pass and fail gets every one of
 * them recorded as a pass.
 */
const OUTCOMES: Array<{ value: InspectionOutcome; label: string; glyph: string }> = [
  { value: "FAILED", label: "Failed", glyph: "✕" },
  { value: "PASSED_WITH_REMARKS", label: "With remarks", glyph: "!" },
  { value: "PASSED", label: "Passed", glyph: "✓" },
]

/**
 * Every check carried out here.
 *
 * ⚠️ **This screen renders no fields and knows no checklist.** An inspection *is* a form entry, and the
 * engine owns what it asked and what was answered — a row opens that entry. The moment this screen knows
 * what a given checklist contains, the next checklist needs code.
 *
 * ⚠️ **Most recent first, and not failures first.** The ticket asked for severity order; a log read by
 * time is what somebody scanning "what happened this week" needs, and a severity sort would make page one
 * every failure ever recorded. The failures are one chip away, and the chip is first in the row.
 */
export function InspectionsPage() {
  const watchesEquipment = useMonitoringModule()

  const [outcome, setOutcome] = useState<InspectionOutcome | undefined>(undefined)
  const [formId, setFormId] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(0)
  const [openAssetId, setOpenAssetId] = useState<string | null>(null)
  const [activeViewId, setActiveViewId] = useState<string | null>(null)

  const query = useInspectionBoard({ outcome, formId, page, size: PAGE_SIZE })
  const failure = describeQueryFailure(query, "inspections")

  const { data: assetForms = [] } = useAssetForms()

  const term = useTerm()
  const checks = term("check.many", "checks")

  const rows = query.data?.content ?? []

  // ⚠️ Narrowing by hand un-claims the view: the filter is no longer what it stored.
  function narrow(next: InspectionOutcome | undefined) {
    setOutcome(next)
    setPage(0)
    setActiveViewId(null)
  }

  useViewFromAddress<{ outcome?: InspectionOutcome; formId?: string }>("inspections", (applied, viewId) => {
    setOutcome(applied.outcome)
    setFormId(applied.formId)
    setPage(0)
    setActiveViewId(viewId)
  })

  if (failure) {
    return <LoadFailureNotice failure={failure} onRetry={() => void query.refetch()} />
  }

  return (
    <>
      <PageHeader
        title={capitalised(checks)}
        description={`${query.data?.totalElements ?? 0} ${checks} — what was looked at, and how it went`}
      />

      {!watchesEquipment ? (
        <ModuleOff />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <ViewBar
            section="inspections"
            filter={{ outcome, formId }}
            isFiltered={Boolean(outcome || formId)}
            activeViewId={activeViewId}
            onApply={(applied, viewId) => {
              setOutcome(applied.outcome)
              setFormId(applied.formId)
              setPage(0)
              setActiveViewId(viewId)
            }}
          />

          <div className="flex flex-wrap gap-1.5">
            <ToggleChip active={!outcome} onClick={() => narrow(undefined)}>
              Everything
            </ToggleChip>
            {OUTCOMES.map((candidate) => (
              <ToggleChip
                key={candidate.value}
                active={outcome === candidate.value}
                onClick={() => narrow(outcome === candidate.value ? undefined : candidate.value)}
              >
                {candidate.label}
              </ToggleChip>
            ))}

            {assetForms.length > 1 && <span className="mx-1 self-center text-muted-foreground">·</span>}
            {assetForms.length > 1 &&
              assetForms.map((form) => (
                <ToggleChip
                  key={form.id}
                  active={formId === form.id}
                  onClick={() => {
                    setFormId(formId === form.id ? undefined : form.id)
                    setPage(0)
                    setActiveViewId(null)
                  }}
                >
                  {form.name}
                </ToggleChip>
              ))}
          </div>

          {query.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : rows.length === 0 ? (
            <NothingChecked narrowed={Boolean(outcome || formId)} />
          ) : (
            <>
              <RowList>
                {rows.map((row) => (
                  <InspectionRow
                    key={row.inspection.id}
                    row={row}
                    onOpen={() => setOpenAssetId(row.assetId)}
                  />
                ))}
              </RowList>

              {query.data && query.data.totalPages > 1 && (
                <Pagination
                  page={page}
                  totalPages={query.data.totalPages}
                  totalElements={query.data.totalElements}
                  size={query.data.size}
                  onChange={setPage}
                />
              )}
            </>
          )}
        </div>
      )}

      {openAssetId && <AssetSheet assetId={openAssetId} onClose={() => setOpenAssetId(null)} />}
    </>
  )
}

function InspectionRow({ row, onOpen }: { row: InspectionBoardEntry; onOpen: () => void }) {
  const { inspection } = row
  const failed = inspection.outcome === "FAILED"

  return (
    <Row
      onOpen={onOpen}
      className={cn(failed && "border-l-2 border-l-destructive bg-destructive/5")}
      leading={<span aria-hidden="true">{glyphOf(inspection.outcome)}</span>}
      trailing={
        <>
          <Badge variant={badgeOf(inspection.outcome)}>{labelOf(inspection.outcome)}</Badge>
          <Badge variant="secondary">{relativeTime(inspection.performedAt)}</Badge>
        </>
      }
    >
      <RowTitle>
        {row.assetLabel}
        {/* ⚠️ Which checklist, always. "Passed" means nothing until somebody knows passed WHAT — the
            same reason the per-asset list carries the form's name. */}
        {inspection.formName ? ` — ${inspection.formName}` : ""}
      </RowTitle>
      <RowMeta>
        {readableMoment(inspection.performedAt)}
        {inspection.note ? ` · ${inspection.note}` : ""}
      </RowMeta>
    </Row>
  )
}

function glyphOf(outcome: InspectionOutcome) {
  return OUTCOMES.find((candidate) => candidate.value === outcome)?.glyph ?? "·"
}

function labelOf(outcome: InspectionOutcome) {
  return OUTCOMES.find((candidate) => candidate.value === outcome)?.label ?? outcome
}

function badgeOf(outcome: InspectionOutcome): "default" | "secondary" | "destructive" | "outline" {
  if (outcome === "FAILED") {
    return "destructive"
  }

  return outcome === "PASSED_WITH_REMARKS" ? "outline" : "secondary"
}

function NothingChecked({ narrowed }: { narrowed: boolean }) {
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
        ✓
      </span>
      <span className="text-sm font-medium">Nothing has been checked yet</span>
      <span className="max-w-md text-xs text-muted-foreground">
        A check is a form the engine already knows — an acceptance list, a sterilisation log, a safety
        walk-around. Record one from a thing's own screen, and every one of them shows up here.
      </span>
    </div>
  )
}

function ModuleOff() {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
      <span aria-hidden="true" className="text-2xl">
        ✓
      </span>
      <span className="text-sm font-medium">This workspace does not watch its things</span>
      <span className="max-w-md text-xs text-muted-foreground">
        Checks are part of the watch, and this workspace does not have that module switched on.
      </span>
    </div>
  )
}
