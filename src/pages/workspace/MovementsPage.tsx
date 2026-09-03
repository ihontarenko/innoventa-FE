import { useState } from "react"
import { Link } from "react-router-dom"
import { Badge, type FilterItem, cn, useKeyboardShortcuts, useListKeyboard } from "@jmouse/ui"
import { ListScreen } from "@/components/layout/ListScreen"
import { DataTable } from "@/components/layout/DataTable"
import { useAddress } from "@/hooks/useAddress"
import { ToggleChip } from "@/components/ToggleChip"
import { useJournal } from "@/hooks/useJournal"
import { useWorkspaceForms } from "@/hooks/useWorkspaceForms"
import { describeQueryFailure } from "@/lib/loadFailure"
import { relativeTime } from "@/lib/dates"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useSpaceStore } from "@/stores/spaceStore"
import type { JournalKind, JournalReference, JournalRow } from "@/api/journal"

const PAGE_SIZE = 50

/**
 * How long a window back, as the question a person actually asks.
 *
 * ⚠️ **A window, not a pair of dates.** "The last week" is what somebody wants from a register; a range
 * is the harder thing to get right in a URL and the harder thing to read back out of one.
 */
const WINDOWS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: undefined, label: "All time" },
] as const

/**
 * The rail's facets.
 *
 * ⚠️ **Two, and they are the two REGISTERS rather than the seven acts.** A rail listing every reason —
 * receipt, issue, write-off, stocktake, correction, handed over, returned — would be seven rows to skim
 * for a screen whose first question is *quantities or equipment*. The act is the badge on the row, and
 * narrowing to one act is what the `?event=` in the address does when a card links here.
 */
const FACETS: Array<{ key: JournalKind; icon: string; label: string }> = [
  { key: "QUANTITY", icon: "⇅", label: "Quantities" },
  { key: "CUSTODY", icon: "⚒", label: "Equipment" },
]

/**
 * What the register calls each act, in words rather than in the enum's shouting.
 *
 * ⚠️ **A map rather than a prettifier over the enum.** `WRITE_OFF` → "Write-off" is a rule that works
 * until the first act whose English is not its constant, and then it is a rule with an exception, which
 * is a map that pretends not to be one.
 */
const EVENT_WORDS: Record<string, { label: string; tone: "in" | "out" | "flat" }> = {
  RECEIPT: { label: "Receipt", tone: "in" },
  ISSUE: { label: "Issue", tone: "out" },
  WRITE_OFF: { label: "Write-off", tone: "out" },
  COUNT: { label: "Stocktake", tone: "flat" },
  EDIT: { label: "Correction", tone: "flat" },
  HANDED_OVER: { label: "Handed over", tone: "out" },
  RETURNED: { label: "Returned", tone: "in" },
}

/**
 * Everything that happened in this workspace, newest first.
 *
 * <h2>⚠️ A register, and the Activity feed is the other thing</h2>
 *
 * <p>This is what a person <em>reconciles</em> against: exact arithmetic, one row per event that really
 * moved something, drawn from the tables that own those events. The Activity feed reads the audit log
 * and shows attempts and refusals too — useful for "what was going on", useless for "why is the count
 * three short". Two tabs of one screen rather than two entries in a menu, because the difference is
 * what you are asking rather than where you are.
 *
 * <h2>⚠️ Everything narrowable is in the address</h2>
 *
 * <p>"What went out to this project last month" is a link somebody sends, not a state they reproduce.
 * It is also how every card's *Full history →* arrives here — the card names the subject in the URL and
 * this screen opens already narrowed.
 */
export function MovementsPage() {
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)
  const { parameters, amend: write } = useAddress()
  const [page, setPage] = useState(0)

  const kind = (parameters.get("kind") as JournalKind | null) ?? undefined
  const days = parameters.get("days") ? Number(parameters.get("days")) : undefined
  const entryId = parameters.get("entry") ?? undefined
  const projectId = parameters.get("project") ?? undefined
  const assetId = parameters.get("asset") ?? undefined
  const locationId = parameters.get("location") ?? undefined
  const holderId = parameters.get("holder") ?? undefined

  const narrowed = Boolean(entryId || projectId || assetId || locationId || holderId)

  const query = useJournal({ kind, days, entryId, projectId, assetId, locationId, holderId }, page, PAGE_SIZE)
  const failure = describeQueryFailure(query, "the journal")

  // ⚠️ The one inventory form of this workspace, so a position row can be linked — the same way the
  // Attention board resolves it. A form per row would be one identifier repeated a hundred times.
  const { data: inventoryForms = [] } = useWorkspaceForms("INVENTORY")
  const inventoryFormId = inventoryForms[0]?.id ?? null

  const rows = query.data?.content ?? []

  // ⚠️ No counts on the facets. Each would be its own request against a register the merge has already
  // paged, and a count that lagged the list by one page is worse than no count at all.
  const facets: FilterItem[] = FACETS.map((facet) => ({ key: facet.key, icon: facet.icon, label: facet.label }))

  const keyboard = useListKeyboard<JournalRow>({ rows, identify: (row) => row.id })

  useKeyboardShortcuts([
    { keys: "j", describes: "Next entry", group: "This list", run: () => keyboard.move(1) },
    { keys: "k", describes: "Previous entry", group: "This list", run: () => keyboard.move(-1) },
  ])

  /** Every narrowing starts the register over — page three of the old answer is not page three of this. */
  function amend(patch: Record<string, string | null>) {
    write(patch)
    setPage(0)
  }

  return (
    <ListScreen
      title="Movements"
      description={
        query.data
          ? `${query.data.totalElements} recorded — quantities and equipment, newest first`
          : "Quantities and equipment, newest first"
      }
      rail={{
        title: "Event",
        items: facets,
        activeKey: kind ?? null,
        onSelect: (key) => amend({ kind: key }),
        allLabel: "Everything",
        allIcon: "☰",
        allCount: query.data?.totalElements,
      }}
      /* ⚠️ The window is a fact about THIS list rather than a way of narrowing it — which is what the
          rail is for — so it sits in the toolbar above the rows, pinned, and not among the facets. */
      toolbar={
        <div className="flex flex-wrap items-center gap-2 px-4 py-2">
          <span className="text-muted-foreground text-[11px] tracking-[0.06em] uppercase">Period</span>

          {WINDOWS.map((window) => (
            <ToggleChip
              key={window.label}
              active={days === window.days}
              onClick={() => amend({ days: window.days ? String(window.days) : null })}
            >
              {window.label}
            </ToggleChip>
          ))}

          {/* ⚠️ Shown only when something IS narrowing, and it says so. A register narrowed to one
              position looks exactly like a quiet workspace, and the difference is the whole reading. */}
          {narrowed && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground ml-auto text-[12px] underline underline-offset-2"
              onClick={() => amend({ entry: null, project: null, asset: null, location: null, holder: null })}
            >
              Narrowed to one thing — show everything
            </button>
          )}
        </div>
      }
      failure={failure}
      onRetry={() => void query.refetch()}
      loading={query.isLoading}
      isEmpty={rows.length === 0}
      empty={{
        title: narrowed || days ? "Nothing in this window" : "Nothing has happened yet",
        text:
          narrowed || days
            ? "Widen the window, or stop narrowing to one thing."
            : "A quantity changes by recording why it changed, and a piece of equipment by being handed over. Both land here.",
      }}
      pagination={
        query.data
          ? {
              page,
              totalPages: query.data.totalPages,
              totalElements: query.data.totalElements,
              size: query.data.size,
              onChange: setPage,
            }
          : undefined
      }
    >
      <DataTable
        rows={rows}
        rowKey={(row) => row.id}
        rowProperties={(row) => keyboard.rowProperties(row)}
        columns={[
          {
            key: "when",
            header: "When",
            className: "text-muted-foreground whitespace-nowrap",
            cell: (row) => relativeTime(row.occurredAt),
          },
          {
            key: "event",
            header: "Event",
            cell: (row) => {
              const words = EVENT_WORDS[row.event] ?? { label: row.event, tone: "flat" as const }

              return (
                <Badge variant={words.tone === "out" ? "destructive" : "secondary"}>{words.label}</Badge>
              )
            },
          },
          {
            key: "what",
            header: "What",
            cell: (row) => (
              <SubjectLink reference={row.subject} spaceSlug={spaceSlug} inventoryFormId={inventoryFormId} />
            ),
          },
          {
            /* ⚠️ The sign is always drawn. A movement whose direction is implied by its badge is one
                somebody misreads the moment they scan past the badge. */
            key: "delta",
            header: "Δ",
            align: "right",
            className: "tabular-nums",
            cell: (row) =>
              row.delta === undefined ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <span className={cn(row.delta < 0 && "text-destructive")}>
                  {row.delta > 0 ? "+" : ""}
                  {row.delta}
                </span>
              ),
          },
          {
            key: "with",
            header: "With",
            cell: (row) =>
              row.counterparty ? (
                <SubjectLink
                  reference={row.counterparty}
                  spaceSlug={spaceSlug}
                  inventoryFormId={inventoryFormId}
                />
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
          {
            key: "who",
            header: "Who",
            className: "text-muted-foreground whitespace-nowrap",
            cell: (row) => row.actorName ?? "—",
          },
          {
            key: "source",
            header: "Source",
            className: "text-muted-foreground text-[11px] whitespace-nowrap",
            cell: (row) => row.source ?? "—",
          },
        ]}
      />
    </ListScreen>
  )
}

/**
 * A reference, as a link where this interface has a screen for it.
 *
 * ⚠️ **Plain text where it does not**, rather than a link to a placeholder. A row that leads nowhere is
 * better than a row that leads to "this screen has not been ported yet" — the second teaches somebody
 * the product is broken; the first is just a name.
 */
function SubjectLink({
  reference,
  spaceSlug,
  inventoryFormId,
}: {
  reference: JournalReference
  spaceSlug: string | null
  /** ⚠️ See {@link destinationOf} — a position needs its form as well as its id to be addressed. */
  inventoryFormId: string | null
}) {
  const path = spaceSlug ? destinationOf(reference, spaceSlug, inventoryFormId) : null

  if (!path) {
    return <span>{reference.label}</span>
  }

  return (
    <Link to={path} className="hover:text-primary underline-offset-2 hover:underline">
      {reference.label}
    </Link>
  )
}

function destinationOf(
  reference: JournalReference,
  spaceSlug: string,
  inventoryFormId: string | null,
): string | null {
  if (reference.type === "project") {
    return spaceSectionPath(spaceSlug, `projects/${reference.id}`)
  }
  if (reference.type === "asset") {
    return spaceSectionPath(spaceSlug, `assets?asset=${reference.id}`)
  }
  /**
   * ⚠️ **A position needs its FORM as well as its id, and the register does not carry one.**
   *
   * It is resolved the way the Attention board already resolves it: every position in a workspace is an
   * entry of the one inventory form, so the form is a property of the workspace rather than of the row.
   * Putting it on every row of the register instead would be the same identifier repeated a hundred
   * times per page — and a second way of answering a question this interface had already answered.
   */
  if (reference.type === "position" && inventoryFormId) {
    return spaceSectionPath(spaceSlug, `inventory/entry/${inventoryFormId}/${reference.id}`)
  }
  return null
}
