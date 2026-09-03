import { useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { cn } from "@jmouse/ui"
import { DataTable } from "@/components/layout/DataTable"
import { ListScreen } from "@/components/layout/ListScreen"
import { NewStocktakeDialog } from "@/components/inventory/NewStocktakeDialog"
import { StocktakeStatusBadge } from "@/components/inventory/StocktakeStatusBadge"
import { useStocktakes } from "@/hooks/useStocktakes"
import { describeQueryFailure } from "@/lib/loadFailure"
import { relativeTime } from "@/lib/dates"
import { spaceSectionPath } from "@/lib/navigationContext"
import { capitalised, useTerm } from "@/hooks/useTerminology"
import { useSpaceStore } from "@/stores/spaceStore"
import type { StocktakeStatus, StocktakeSummary } from "@/api/stocktakes"

/**
 * The counting sheets of a workspace.
 *
 * ⚠️ **The same shell as Inventory and Parts**, through `ListScreen`: a rail on the left, the search and
 * the one action in the header, a dense bordered table. This screen invented its own arrangement first,
 * which is exactly the habit the shell exists to stop.
 *
 * ⚠️ **The rail lists STATES rather than types**, because that is what a sheet is told apart by. A
 * stocktake has no type; what somebody scanning this list wants is *which of these still need walking*.
 *
 * ⚠️ **Progress is two numbers, never a percentage.** *14 of 20 counted* says how far somebody got and
 * how big the walk is; a bar at 70% says neither, and a sheet is a physical job whose size is the thing
 * you plan around.
 */
const STATES: { key: StocktakeStatus; label: string; icon: string }[] = [
  { key: "OPEN", label: "Drawn", icon: "◻" },
  { key: "COUNTING", label: "Counting", icon: "◐" },
  { key: "CLOSED", label: "Closed", icon: "◼" },
]

export function StocktakesPage() {
  const navigate = useNavigate()
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)
  const term = useTerm()

  const [status, setStatus] = useState<StocktakeStatus | null>(null)
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)
  const searchBox = useRef<HTMLInputElement>(null)

  const sheetsQuery = useStocktakes(status)
  const { data, isLoading, refetch } = sheetsQuery
  const failure = describeQueryFailure(sheetsQuery, "stocktakes")

  const sheets = useMemo(() => data?.content ?? [], [data])

  /**
   * ⚠️ **The state narrowing goes to the SERVER; the text match is over the rows in hand.** A sheet in
   * another state may be on another page, so that one cannot be done here — while a list nobody has
   * thousands of is honestly searchable in the browser, and the empty state says which it did.
   */
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()

    if (needle === "") {
      return sheets
    }

    return sheets.filter(
      (sheet) =>
        sheet.number.toLowerCase().includes(needle) ||
        sheet.scopeLabel.toLowerCase().includes(needle) ||
        (sheet.responsibleName ?? "").toLowerCase().includes(needle),
    )
  }, [sheets, search])

  const railItems = STATES.map((state) => ({
    key: state.key,
    icon: state.icon,
    label: state.label,
    count: sheets.filter((sheet) => sheet.status === state.key).length,
  }))

  function open(sheet: StocktakeSummary) {
    navigate(`${spaceSectionPath(spaceSlug ?? "", "stocktakes")}/${sheet.id}`)
  }

  const chosen = STATES.find((state) => state.key === status)

  return (
    <>
      <ListScreen
        title="Stocktakes"
        description={`${chosen?.label ?? "All sheets"} — ${sheets.length} recorded`}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search every sheet… ( / )",
          inputRef: searchBox,
        }}
        action={{ label: "New stocktake", onClick: () => setCreating(true) }}
        rail={{
          title: "State",
          items: railItems,
          activeKey: status,
          onSelect: (key) => setStatus(key as StocktakeStatus | null),
          allLabel: "All sheets",
          allIcon: "☰",
          allCount: sheets.length,
        }}
        failure={failure}
        onRetry={() => void refetch()}
        loading={isLoading}
        loadingRows={8}
        isEmpty={visible.length === 0}
        empty={{
          title: search ? "Nothing matches" : status ? "No sheets in this state" : "No stocktakes yet",
          text: search
            ? "The search looks at the sheets in hand — clear the state on the left to widen it."
            : status
              ? "A sheet is drawn, then counted, then closed."
              : "Draw one over a place or a type of part, walk it, and close it. The differences become movements.",
          actions:
            search || status
              ? []
              : [{ label: "New stocktake", primary: true, onClick: () => setCreating(true) }],
        }}
      >
        <DataTable
          rows={visible}
          rowKey={(sheet) => sheet.id}
          onRowClick={open}
          columns={[
            { key: "number", header: "Number", className: "font-mono", cell: (sheet) => sheet.number },
            {
              key: "status",
              header: "State",
              cell: (sheet) => <StocktakeStatusBadge status={sheet.status} />,
            },
            {
              key: "scope",
              header: "Scope",
              className: "max-w-64 truncate",
              cell: (sheet) => sheet.scopeLabel,
            },
            {
              key: "responsible",
              header: capitalised(term("holder.one", "person")),
              cell: (sheet) => sheet.responsibleName ?? "—",
            },
            {
              key: "counted",
              header: "Counted",
              align: "right",
              cell: (sheet) => (
                <>
                  {sheet.counted} <span className="text-muted-foreground">of {sheet.lineCount}</span>
                </>
              ),
            },
            {
              key: "discrepancies",
              header: "Discrepancies",
              align: "right",
              /* ⚠️ Drawn at zero too. "Counted, and everything agreed" is the outcome a stocktake exists
                 to be able to state; a column that appeared only on trouble would leave a clean count
                 looking like an unfinished one. */
              cell: (sheet) => (
                <span className={cn(sheet.discrepancies > 0 && "text-destructive")}>
                  {sheet.discrepancies}
                </span>
              ),
            },
            {
              key: "net",
              header: "Net",
              align: "right",
              cell: (sheet) => (sheet.netDifference === 0 ? "—" : signed(sheet.netDifference)),
            },
            {
              key: "created",
              header: "Drawn",
              className: "text-muted-foreground",
              cell: (sheet) => relativeTime(sheet.createdAt),
            },
          ]}
        />
      </ListScreen>

      <NewStocktakeDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(sheet) => {
          toast.success(`${sheet.number} drawn — ${sheet.lineCount} position(s) to count.`)
          navigate(`${spaceSectionPath(spaceSlug ?? "", "stocktakes")}/${sheet.id}`)
        }}
      />
    </>
  )
}

/** ⚠️ A difference reads as a direction, so the sign is always drawn — including the plus. */
function signed(value: number) {
  return value > 0 ? `+${value}` : String(value)
}
