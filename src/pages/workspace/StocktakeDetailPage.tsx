import { useRef, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Button, Input, PageState, cn } from "@jmouse/ui"
import { ListScreen } from "@/components/layout/ListScreen"
import { LoadFailureNotice } from "@/components/LoadFailureNotice"
import { StocktakeStatusBadge } from "@/components/inventory/StocktakeStatusBadge"
import {
  useCloseStocktake,
  useCountLine,
  useStartStocktake,
  useStocktake,
} from "@/hooks/useStocktakes"
import { describeQueryFailure } from "@/lib/loadFailure"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useSpaceStore } from "@/stores/spaceStore"
import type { StocktakeLine } from "@/api/stocktakes"

/**
 * One counting sheet, as somebody walking a shelf uses it.
 *
 * <h2>⚠️ The count field is the screen, and everything else gets out of its way</h2>
 *
 * A person with a clipboard types a number and moves on, a hundred times. So Enter commits the row and
 * moves to the next one, the field is the only thing focusable in the row, and nothing re-orders or
 * re-sorts underneath them — a sheet that re-sorted as it was filled would lose somebody's place in a
 * physical drawer.
 *
 * <h2>⚠️ Three numbers per row, and none of them is redundant</h2>
 *
 * `expected` is what the system believed when the sheet was drawn — what the count is judged against.
 * `nowInSystem` is what it believes this second, which differs when somebody moved stock mid-walk.
 * `difference` is what closing will post. Collapsing the first two would hide exactly the situation a
 * counter needs to be told about.
 */
export function StocktakeDetailPage() {
  const { stocktakeId } = useParams()
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)

  const sheetQuery = useStocktake(stocktakeId)
  const { data: sheet, isLoading } = sheetQuery
  const failure = describeQueryFailure(sheetQuery, "stocktake")

  const count = useCountLine(stocktakeId)
  const start = useStartStocktake(stocktakeId)
  const close = useCloseStocktake(stocktakeId)

  const [confirmingClose, setConfirmingClose] = useState(false)
  const fields = useRef(new Map<string, HTMLInputElement>())

  if (isLoading) {
    return <PageState kind="loading" rows={10} />
  }

  if (failure) {
    return <LoadFailureNotice failure={failure} />
  }

  if (!sheet) {
    return <PageState kind="empty" title="No such sheet" text="It may have been discarded." />
  }

  const closed = sheet.status === "CLOSED"
  const notCounted = sheet.lineCount - sheet.counted

  /**
   * ⚠️ **Enter moves to the next row rather than submitting a form.** The whole interaction is one
   * number after another down a physical shelf; making somebody reach for the mouse between rows is
   * what makes people count on paper instead and type it in afterwards.
   */
  function commit(line: StocktakeLine, raw: string, moveOn: boolean) {
    const value = raw.trim()

    if (value === "" || Number.isNaN(Number(value))) {
      return
    }

    count.mutate(
      { entryId: line.entryId, counted: Number(value) },
      {
        onError: (problem: unknown) => {
          const detail = problem as { response?: { data?: { detail?: string } } }
          toast.error(detail.response?.data?.detail ?? "That count could not be written.")
        },
      },
    )

    if (moveOn) {
      focusAfter(line.entryId)
    }
  }

  function focusAfter(entryId: string) {
    const order = sheet!.lines.map((line) => line.entryId)
    const next = order[order.indexOf(entryId) + 1]

    if (next) {
      fields.current.get(next)?.focus()
      fields.current.get(next)?.select()
    }
  }

  return (
    <ListScreen
      title={
        <span className="flex items-center gap-2">
          <span className="font-mono">{sheet.number}</span>
          <StocktakeStatusBadge status={sheet.status} />
        </span>
      }
      description={
        /* ⚠️ A sheet is reached from the list and has to lead back to it. The sidebar entry does that
            too, but only somebody who already knows a sheet is a stocktake would look there. */
        <span>
          <Link
            className="hover:text-foreground underline-offset-2 hover:underline"
            to={spaceSectionPath(spaceSlug ?? "", "stocktakes")}
          >
            Stocktakes
          </Link>
          {" · "}
          {sheet.locationId ? sheet.locationPath : sheet.catalogFormName}
          {sheet.locationId && sheet.includeNested && " — including what is inside it"}
          {sheet.responsibleName && ` · ${sheet.responsibleName}`}
        </span>
      }
      extraActions={
        <>
          <Link
            className="text-muted-foreground hover:text-foreground text-[13px]"
            to={`${spaceSectionPath(spaceSlug ?? "", "movements")}?stocktake=${sheet.id}`}
          >
            Movements
          </Link>
          {sheet.status === "OPEN" && (
            <Button size="sm" variant="outline" onClick={() => start.mutate()}>
              Start counting
            </Button>
          )}
        </>
      }
      action={
        closed
          ? undefined
          : {
              label: "Close with adjustment",
              onClick: () => setConfirmingClose(true),
              disabled: sheet.counted === 0,
            }
      }
      /* ⚠️ Five numbers pinned above the rows, and "not counted" is one of them. A sheet that showed
          only progress would let somebody close it believing they had finished. */
      toolbar={
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 text-[13px]">
            <Figure label="rows" value={sheet.lineCount} />
            <Figure label="counted" value={sheet.counted} />
            <Figure label="not counted" value={notCounted} tone={notCounted > 0 ? "warn" : undefined} />
            <Figure
              label="discrepancies"
              value={sheet.discrepancies}
              tone={sheet.discrepancies > 0 ? "warn" : undefined}
            />
            <Figure label="net" value={sheet.netDifference === 0 ? "—" : signed(sheet.netDifference)} />
            {sheet.note && <span className="text-muted-foreground">{sheet.note}</span>}
          </div>

          {confirmingClose && (
            <div className="bg-muted/40 flex flex-wrap items-center gap-3 border-t px-4 py-2 text-[13px]">
              <span>
                {sheet.discrepancies === 0
                  ? "Everything counted agrees — closing will post no movements."
                  : `${sheet.discrepancies} row(s) disagree and will be posted as COUNT movements.`}
                {notCounted > 0 && ` ${notCounted} row(s) were never counted and will be left alone.`}
              </span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setConfirmingClose(false)}>
                  Not yet
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    close.mutate(undefined, {
                      onSuccess: (result) => {
                        setConfirmingClose(false)
                        toast.success(
                          `${result.number} closed — ${result.posted} movement(s) posted, ` +
                            `${result.unchanged} agreed, ${result.notCounted} not counted.`,
                        )
                      },
                      onError: (problem: unknown) => {
                        const detail = problem as { response?: { data?: { detail?: string } } }
                        toast.error(detail.response?.data?.detail ?? "The sheet could not be closed.")
                      },
                    })
                  }
                  disabled={close.isPending}
                >
                  {close.isPending ? "Closing…" : "Close and post"}
                </Button>
              </div>
            </div>
          )}
        </>
      }
      footnote={
        closed ? (
          <>
            This sheet is closed. Its differences are in the register —{" "}
            <Link
              className="underline"
              to={`${spaceSectionPath(spaceSlug ?? "", "movements")}?stocktake=${sheet.id}`}
            >
              see the movements it posted
            </Link>
            . Draw a new sheet to count again.
          </>
        ) : (
          "Type a number and press Enter — the count is saved and the cursor moves to the next row."
        )
      }
    >
      {/* ⚠️ The one hand-written table left in the product, and it earns it: a cell here is an INPUT
          that saves on Enter and moves down. `DataTable` renders values, and threading a per-row ref
          and a keyboard walk through a column contract would make every other table pay for it. The
          chrome — the sticky header, the row rule, the alignment — is copied from it exactly. */}
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-background text-muted-foreground border-b text-[10px] uppercase tracking-[0.06em]">
            <th className="px-2.5 py-1.5 text-left font-medium">Position</th>
            <th className="px-2.5 py-1.5 text-left font-medium">Place</th>
            <th className="px-2.5 py-1.5 text-right font-medium">On the books</th>
            <th className="px-2.5 py-1.5 text-right font-medium">Actually found</th>
            <th className="px-2.5 py-1.5 text-right font-medium">Difference</th>
            <th className="px-2.5 py-1.5 text-right font-medium">Now in system</th>
            <th className="px-2.5 py-1.5 text-left font-medium">Counted by</th>
          </tr>
        </thead>
          <tbody>
            {sheet.lines.map((line) => (
              <tr key={line.entryId} className="border-b last:border-b-0">
                <td className="max-w-72 truncate px-2.5 py-1.5">{line.label}</td>
                <td className="text-muted-foreground max-w-56 truncate px-2.5 py-1.5">
                  {line.locationPath ?? "—"}
                </td>
                <td className="px-2.5 py-1.5 text-right tabular-nums">
                  {line.expected} {line.unit && <span className="text-muted-foreground">{line.unit}</span>}
                </td>
                <td className="px-2.5 py-1 text-right">
                  {closed ? (
                    <span className="tabular-nums">{line.counted ?? "—"}</span>
                  ) : (
                    <Input
                      ref={(element) => {
                        if (element) {
                          fields.current.set(line.entryId, element)
                        } else {
                          fields.current.delete(line.entryId)
                        }
                      }}
                      className="h-7 w-24 text-right tabular-nums"
                      inputMode="decimal"
                      defaultValue={line.counted ?? ""}
                      aria-label={`Counted for ${line.label}`}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault()
                          commit(line, event.currentTarget.value, true)
                        }
                      }}
                      onBlur={(event) => commit(line, event.currentTarget.value, false)}
                    />
                  )}
                </td>
                <td
                  className={cn(
                    "px-2.5 py-1 text-right tabular-nums",
                    line.difference != null && line.difference !== 0 && "text-destructive",
                  )}
                >
                  {line.difference == null ? "—" : line.difference === 0 ? "0" : signed(line.difference)}
                </td>
                <td
                  className={cn(
                    "px-2.5 py-1 text-right tabular-nums",
                    // ⚠️ Marked only when it disagrees with what the sheet froze — that is the case
                    // worth a second look, and marking every row would mark nothing.
                    line.nowInSystem !== line.expected && "text-muted-foreground font-medium",
                  )}
                >
                  {line.nowInSystem}
                  {line.nowInSystem !== line.expected && (
                    <span className="ml-1 text-[11px]" title="Stock moved since the sheet was drawn">
                      ≠
                    </span>
                  )}
                </td>
                <td className="text-muted-foreground px-2.5 py-1.5">{line.countedBy ?? "—"}</td>
              </tr>
            ))}
          </tbody>
      </table>
    </ListScreen>
  )
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string
  value: number | string
  tone?: "warn"
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className={cn("font-medium tabular-nums", tone === "warn" && "text-destructive")}>
        {value}
      </span>
      <span className="text-muted-foreground text-[12px]">{label}</span>
    </span>
  )
}

/** ⚠️ A difference reads as a direction, so the sign is always drawn — including the plus. */
function signed(value: number) {
  return value > 0 ? `+${value}` : String(value)
}
