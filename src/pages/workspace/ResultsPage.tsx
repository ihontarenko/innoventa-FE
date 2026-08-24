import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Badge, Button, type FilterItem, FilterPanel, Input, Skeleton, cn } from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { Pagination } from "@/components/Pagination"
import { SegmentedControl } from "@/components/SegmentedControl"
import { ToggleChip } from "@/components/ToggleChip"
import { QueryPanel, type AppliedQuery } from "@jmouse/query"
import { entriesOf, ENTRIES } from "@/components/query/subjects"
import { presetsFor } from "@/components/query/presets"
import { QUERY_LABELS } from "@/components/query/labels"
import { EntryDetailDrawer } from "@/components/form/EntryDetailDrawer"
import { parseFileFieldValue } from "@/api/files"
import {
  useDeleteEntry,
  useEntries,
  useEntriesByPurpose,
  usePurposes,
  useUpdateEntry,
} from "@/hooks/useWorkspaceForms"
import { useForm } from "@/hooks/useForms"
import { useSpaces } from "@/hooks/useSpaces"
import { relativeTime, readableMoment } from "@/lib/dates"
import { useSpaceStore } from "@/stores/spaceStore"
import type { FormEntry } from "@/types"

const PAGE_SIZE = 25

/** How often a live view re-asks. ⚠️ Ten seconds, and it is off by default — it is a poll, not a stream. */
const LIVE_INTERVAL_MILLISECONDS = 10_000

/**
 * Every submission of a purpose, whoever sent it and wherever it landed.
 *
 * ⚠️ **Two independent questions, and neither is a filter over the other.** *Mine / Everyone* is about
 * the submitter; *this workspace / everywhere* is about where the row landed. The second matters more
 * than it looks: a public form's submission belongs to **no** workspace at all, so it is invisible from
 * inside one — "everywhere" is the only place a bug report or a landing-page answer can be read.
 *
 * ⚠️ **No batch print.** A print design lays out *one* form's fields, and this list is every form under
 * a purpose — so "print everything here" names no design that could serve it. One record prints from its
 * own drawer, where the form is known.
 */
export function ResultsPage() {
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId)

  /**
   * ⚠️ **One form, when the address names one.** This screen is per PURPOSE, which is right for reading
   * a stream but useless from a form card: there was no way at all from "Contact Us" to "the Contact Us
   * submissions". The address answers it, so the link is shareable and Back goes where somebody expects.
   */
  const [parameters, setParameters] = useSearchParams()
  const formId = parameters.get("form")

  // ⚠️ A way back out. Narrowed to one form with nothing saying so, and no control to clear it, the
  // screen would look like a purpose that had lost most of its rows.
  const showEveryForm = () => setParameters({}, { replace: true })

  const { data: purposes = [] } = usePurposes()
  const { data: spaces = [] } = useSpaces()

  const [purposeCode, setPurposeCode] = useState<string | null>(null)
  const [everybody, setEverybody] = useState(true)
  const [scopedToWorkspace, setScopedToWorkspace] = useState(Boolean(activeSpaceId))
  const [isLive, setLive] = useState(false)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [openEntry, setOpenEntry] = useState<FormEntry | null>(null)
  const [jmq, setJmq] = useState<AppliedQuery>({})
  const [composing, setComposing] = useState(false)

  // With no workspace to stand in there is nothing to scope to, and the control would be a lie.
  const effectivelyScoped = Boolean(activeSpaceId) && scopedToWorkspace
  const activeCode = purposeCode ?? purposes[0]?.code

  const byPurpose = useEntriesByPurpose(formId ? undefined : activeCode, page, PAGE_SIZE, {
    everybody,
    scopedToWorkspace: effectivelyScoped,
    refetchMilliseconds: isLive ? LIVE_INTERVAL_MILLISECONDS : undefined,
    query: search.trim() || undefined,
  })

  // ⚠️ A different QUESTION rather than a narrowing of the same one: one form's rows come from that
  // form's own endpoint, which is the only one that can page them honestly.
  // ⚠️ The jMQ filter belongs to the ONE-FORM view and nowhere else: `entry[quantity]` means whatever
  // the form it is written against says it means, and a purpose spans several forms.
  const byForm = useEntries(formId ?? undefined, page, PAGE_SIZE, search.trim() || undefined, jmq)

  const { data: resultsPage, isLoading, isRefetching } = formId ? byForm : byPurpose

  const updateEntry = useUpdateEntry()
  const deleteEntry = useDeleteEntry()

  const spaceNames = useMemo(() => new Map(spaces.map((space) => [space.id, space.name])), [spaces])

  // ⚠️ **The search reaches the database now**, so nothing is filtered here and the count in the header
  // is the real one. It used to narrow the page in hand, which answered "3" after looking at twenty-five.
  const entries = resultsPage?.content ?? []

  const filterItems: FilterItem[] = purposes.map((purpose) => ({
    key: purpose.code,
    icon: purpose.icon ?? "📄",
    label: purpose.label,
  }))

  function choosePurpose(code: string | null) {
    setPurposeCode(code ?? purposes[0]?.code ?? null)
    setPage(0)
    setSearch("")
    setOpenEntry(null)
    // ⚠️ Picking a purpose leaves the one-form view. Narrowed to a form AND highlighting a purpose, the
    // panel would claim a filter that is not in force.
    setParameters({}, { replace: true })
  }

  const total = resultsPage?.totalElements ?? 0

  /**
   * ⚠️ **Fetched, not read off a row.** Taking it from the first entry is free until the form has none —
   * and a form with no submissions is exactly the one somebody opens to check, so the header fell back
   * to a generic word precisely when the name mattered most.
   */
  const { data: chosenForm } = useForm(formId ?? undefined)
  const formName = chosenForm?.name

  return (
    <>
      <PageHeader
        title={formId ? formName ?? "Submissions" : "Submissions"}
        description={
          formId
            ? `${total} submitted against this form`
            : effectivelyScoped
              ? `${total} submitted in this workspace`
              : `${total} everywhere — including public forms that belong to no workspace`
        }
        actions={
          <>
            {formId && (
              <Button size="sm" variant="outline" onClick={showEveryForm}>
                Every form
              </Button>
            )}

            {/* ⚠️ Offered only on the one-form view — see the hook above for why. */}
            {formId && (
              <ToggleChip active={composing} onClick={() => setComposing((previous) => !previous)}>
                Фільтр
              </ToggleChip>
            )}

            <Input
              className="h-8 w-56 text-sm"
              value={search}
              placeholder="Search every submission…"
              onChange={(event) => setSearch(event.target.value)}
            />

            <ToggleChip
              active={isLive}
              title={isLive ? "Stop re-asking" : `Re-ask every ${LIVE_INTERVAL_MILLISECONDS / 1000} seconds`}
              onClick={() => setLive((previous) => !previous)}
            >
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-1.5 rounded-full",
                    isLive ? (isRefetching ? "bg-current" : "animate-pulse bg-current") : "bg-muted-foreground",
                  )}
                />
                {isLive ? "Live" : "Not live"}
              </span>
            </ToggleChip>

            {activeSpaceId && (
              <SegmentedControl
                size="control"
                value={scopedToWorkspace ? "space" : "everywhere"}
                onChange={(next) => {
                  setScopedToWorkspace(next === "space")
                  setPage(0)
                }}
                ariaLabel="Where submissions landed"
                segments={[
                  { value: "space", label: "This workspace" },
                  { value: "everywhere", label: "Everywhere" },
                ]}
              />
            )}

            <SegmentedControl
              size="control"
              value={everybody ? "everyone" : "mine"}
              onChange={(next) => {
                setEverybody(next === "everyone")
                setPage(0)
              }}
              ariaLabel="Whose submissions"
              segments={[
                { value: "mine", label: "Mine" },
                { value: "everyone", label: "Everyone" },
              ]}
            />
          </>
        }
      />

      {/*
        ⚠️ Below the header rather than in a drawer: a filter somebody is composing and the rows it will
        narrow belong on one screen. A panel that covered the list would make every adjustment a guess.
      */}
      {formId && composing && (
        <QueryPanel
          subject={entriesOf(formId)}
          query={jmq}
          presets={presetsFor(ENTRIES)}
          labels={QUERY_LABELS}
          placeholder="entry[component_name] is contains('кос') and entry[quantity] | int < 5"
          onApply={(applied) => {
            setJmq(applied)
            setPage(0)
          }}
        />
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <FilterPanel
          title="Purposes"
          items={filterItems}
          activeKey={formId ? null : (activeCode ?? null)}
          onSelect={choosePurpose}
          allLabel="Every purpose"
          allIcon="☰"
          searchable={filterItems.length > 8}
        />

        <div className="flex min-w-0 flex-col gap-3">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
              <span aria-hidden="true" className="text-2xl">
                ◔
              </span>
              <span className="text-sm font-medium">Nothing here</span>
              <span className="max-w-md text-xs text-muted-foreground">
                {effectivelyScoped
                  ? "Nothing has been submitted in this workspace. Public submissions belong to no workspace at all — look everywhere."
                  : everybody
                    ? "Nothing has been submitted under this purpose."
                    : "You have not submitted anything under this purpose."}
              </span>
              {effectivelyScoped && (
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setScopedToWorkspace(false)}>
                  Look everywhere
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col overflow-hidden rounded-md border">
              <div className="min-w-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-[10px] tracking-[0.06em] text-muted-foreground uppercase">
                      <th className="w-36 px-2.5 py-1.5 text-left font-medium">Submitted</th>
                      <th className="w-56 px-2.5 py-1.5 text-left font-medium">Form</th>
                      {everybody && <th className="w-52 px-2.5 py-1.5 text-left font-medium">By</th>}
                      <th className="px-2.5 py-1.5 text-left font-medium">What it said</th>
                    </tr>
                  </thead>

                  <tbody>
                    {entries.map((entry) => (
                      <tr
                        key={entry.id}
                        onClick={() => setOpenEntry(entry)}
                        className={cn(
                          "cursor-pointer border-b transition-colors last:border-b-0 hover:bg-accent",
                          openEntry?.id === entry.id && "bg-accent",
                        )}
                      >
                        <td className="px-2.5 py-1.5" title={readableMoment(entry.createdAt)}>
                          <span className="block text-xs">{relativeTime(entry.createdAt)}</span>
                          <span className="block font-mono text-[10px] text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </span>
                        </td>

                        <td className="px-2.5 py-1.5">
                          <span className="block truncate text-xs font-medium">{entry.formName}</span>
                          <WhereItLanded spaceId={entry.spaceId} spaceNames={spaceNames} />
                        </td>

                        {everybody && (
                          <td className="max-w-52 truncate px-2.5 py-1.5 text-xs">
                            {entry.submitterEmail ?? <span className="text-muted-foreground">Anonymous</span>}
                          </td>
                        )}

                        <td className="px-2.5 py-1.5">
                          <Preview fieldValues={entry.fieldValues} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {resultsPage && resultsPage.totalPages > 1 && (
                <Pagination
                  page={page}
                  totalPages={resultsPage.totalPages}
                  totalElements={resultsPage.totalElements}
                  size={resultsPage.size}
                  onChange={setPage}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {openEntry && (
        <EntryDetailDrawer
          formId={openEntry.formId}
          formName={openEntry.formName}
          entry={openEntry}
          isSubmitting={updateEntry.isPending}
          onSubmit={async (fieldValues) => {
            await updateEntry.mutateAsync({ formId: openEntry.formId, entryId: openEntry.id, fieldValues })
            toast.success("Saved.")
          }}
          onDelete={() => {
            deleteEntry.mutate(
              { formId: openEntry.formId, entryId: openEntry.id },
              { onSuccess: () => toast.success("Deleted.") },
            )
            setOpenEntry(null)
          }}
          onClose={() => setOpenEntry(null)}
        />
      )}
    </>
  )
}

/**
 * ⚠️ **"No workspace" is a real answer and gets its own mark.** It means a public form — a landing page,
 * a bug report — and reading it as "some other workspace" sends somebody looking for a membership that
 * was never the reason.
 */
function WhereItLanded({ spaceId, spaceNames }: { spaceId: string | null; spaceNames: Map<string, string> }) {
  if (spaceId === null) {
    return (
      <Badge variant="outline" title="Submitted outside any workspace — a public form">
        Public
      </Badge>
    )
  }

  const name = spaceNames.get(spaceId)

  return (
    <Badge variant="secondary" title={name ? `Workspace: ${name}` : "A workspace you are not a member of"}>
      {name ?? "Another workspace"}
    </Badge>
  )
}

/**
 * The first few answers, as chips.
 *
 * ⚠️ **Keyed by field *name*, and formatted without the schema.** This list spans every form under a
 * purpose; loading each one's definition to preview a row would be a request per row. So the formatting
 * below works on the value alone — a pipe is a composite, `true` is a tick, a URL is its host — and it is
 * deliberately approximate. The drawer, which does have the schema, is where a value is read properly.
 */
function Preview({ fieldValues }: { fieldValues: Record<string, string> }) {
  const pairs = Object.entries(fieldValues)
    .filter(([, value]) => value !== undefined && value !== "")
    .slice(0, 4)
    .map(([name, value]) => ({ name, shown: previewToken(value) }))
    .filter((pair) => pair.shown !== "")

  if (pairs.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  return (
    <span className="flex flex-wrap gap-1">
      {pairs.map((pair) => (
        <span key={pair.name} className="flex items-baseline gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10px]">
          <span className="font-mono text-muted-foreground">{pair.name}</span>
          <span className="max-w-40 truncate">{pair.shown}</span>
        </span>
      ))}
    </span>
  )
}

function previewToken(value: string): string {
  if (!value) {
    return ""
  }

  const file = parseFileFieldValue(value)

  if (file) {
    return `📎 ${file.filename}`
  }

  if (value === "true") {
    return "✓"
  }

  if (value === "false") {
    return "✕"
  }

  if (value.includes("|")) {
    const [number, unit] = value.split("|", 2)

    if (!Number.isNaN(Number(number))) {
      return unit ? `${number} ${unit}` : number
    }
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      return new URL(value).hostname
    } catch {
      return value
    }
  }

  return value
}
