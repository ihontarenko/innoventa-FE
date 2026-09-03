import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge, Button, type FilterItem, cn } from "@jmouse/ui"
import { ListScreen } from "@/components/layout/ListScreen"
import { DataTable } from "@/components/layout/DataTable"
import { SegmentedControl } from "@/components/SegmentedControl"
import { QueryPanel } from "@jmouse/query"
import { entriesOf } from "@/components/query/subjects"
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
import { useAddress } from "@/hooks/useAddress"
import { relativeTime, readableMoment } from "@/lib/dates"
import { spaceSectionPath } from "@/lib/navigationContext"
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
  const activeSpaceSlug = useSpaceStore((state) => state.activeSpaceSlug)

  /**
   * ⚠️ **One form, when the address names one.** This screen is per PURPOSE, which is right for reading
   * a stream but useless from a form card: there was no way at all from "Contact Us" to "the Contact Us
   * submissions". The address answers it, so the link is shareable and Back goes where somebody expects.
   */
  const { parameters, amend, query: jmq, setQuery: setJmq } = useAddress()
  const formId = parameters.get("form")

  // ⚠️ A way back out. Narrowed to one form with nothing saying so, and no control to clear it, the
  // screen would look like a purpose that had lost most of its rows.
  // ⚠️ The filter goes with it: it is written against the form's own vocabulary and means nothing once
  // the screen is back to spanning a purpose.
  const showEveryForm = () => amend({ form: null, "jmq:filter": null, "jmq:order": null, page: null })

  const { data: purposes = [] } = usePurposes()
  const { data: spaces = [] } = useSpaces()

  const [purposeCode, setPurposeCode] = useState<string | null>(null)
  const [everybody, setEverybody] = useState(true)
  const [scopedToWorkspace, setScopedToWorkspace] = useState(Boolean(activeSpaceId))
  const [isLive, setLive] = useState(false)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [openEntry, setOpenEntry] = useState<FormEntry | null>(null)
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
    amend({ form: null, "jmq:filter": null, "jmq:order": null })
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
      <ListScreen
        title={formId ? (formName ?? "Submissions") : "Submissions"}
        description={
          formId
            ? `${total} submitted against this form`
            : effectivelyScoped
              ? `${total} submitted in this workspace`
              : `${total} everywhere — including public forms that belong to no workspace`
        }
        search={{ value: search, onChange: setSearch, placeholder: "Search every submission…" }}
        chips={[
          // ⚠️ Offered only on the one-form view — see the hook above for why.
          ...(formId
            ? [{ label: "Filter", active: composing, onClick: () => setComposing((previous) => !previous) }]
            : []),
          {
            label: (
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-1.5 rounded-full",
                    isLive
                      ? isRefetching
                        ? "bg-current"
                        : "animate-pulse bg-current"
                      : "bg-muted-foreground",
                  )}
                />
                {isLive ? "Live" : "Not live"}
              </span>
            ),
            active: isLive,
            title: isLive ? "Stop re-asking" : `Re-ask every ${LIVE_INTERVAL_MILLISECONDS / 1000} seconds`,
            onClick: () => setLive((previous) => !previous),
          },
        ]}
        extraActions={
          <>
            {formId && (
              <Button size="sm" variant="outline" onClick={showEveryForm}>
                Every form
              </Button>
            )}

            {activeSpaceId && (
              <SegmentedControl
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
        /* ⚠️ Below the header rather than in a drawer: a filter somebody is composing and the rows it
            will narrow belong on one screen. A panel that covered the list would make every adjustment
            a guess. */
        banner={
          formId && composing ? (
            <div className="shrink-0 border-b">
              <QueryPanel
                subject={entriesOf(formId)}
                query={jmq}
                labels={QUERY_LABELS}
                placeholder="entry[component_name] is contains('кос') and entry[quantity] | int < 5"
                onApply={(applied) => {
                  setJmq(applied)
                  setPage(0)
                }}
              />
            </div>
          ) : undefined
        }
        rail={{
          title: "Purposes",
          items: filterItems,
          activeKey: formId ? null : (activeCode ?? null),
          onSelect: choosePurpose,
          allLabel: "Every purpose",
          allIcon: "☰",
          searchable: filterItems.length > 8,
        }}
        loading={isLoading}
        isEmpty={entries.length === 0}
        empty={{
          title: "Nothing here",
          text: effectivelyScoped
            ? "Nothing has been submitted in this workspace. Public submissions belong to no workspace at all — look everywhere."
            : everybody
              ? "Nothing has been submitted under this purpose."
              : "You have not submitted anything under this purpose.",
          actions: effectivelyScoped
            ? [{ label: "Look everywhere", onClick: () => setScopedToWorkspace(false) }]
            : [],
        }}
        pagination={
          resultsPage
            ? {
                page,
                totalPages: resultsPage.totalPages,
                totalElements: resultsPage.totalElements,
                size: resultsPage.size,
                onChange: setPage,
              }
            : undefined
        }
      >
        <DataTable
          rows={entries}
          rowKey={(entry) => entry.id}
          onRowClick={(entry) => setOpenEntry(entry)}
          rowClassName={(entry) => (openEntry?.id === entry.id ? "bg-accent" : undefined)}
          columns={[
            {
              key: "submitted",
              header: "Submitted",
              className: "w-36",
              cell: (entry) => (
                <span title={readableMoment(entry.createdAt)}>
                  <span className="block text-xs">{relativeTime(entry.createdAt)}</span>
                  <span className="text-muted-foreground block font-mono text-[10px]">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </span>
                </span>
              ),
            },
            {
              key: "form",
              header: "Form",
              className: "w-56",
              cell: (entry) => (
                <>
                  <span className="block truncate text-xs font-medium">{entry.formName}</span>
                  <WhereItLanded spaceId={entry.spaceId} spaceNames={spaceNames} />
                </>
              ),
            },
            ...(everybody
              ? [
                  {
                    key: "by",
                    header: "By",
                    className: "max-w-52 truncate text-xs",
                    cell: (entry: FormEntry) =>
                      entry.submitterEmail ?? <span className="text-muted-foreground">Anonymous</span>,
                  },
                ]
              : []),
            {
              key: "said",
              header: "What it said",
              cell: (entry) => <Preview fieldValues={entry.fieldValues} />,
            },
          ]}
        />
      </ListScreen>

      {openEntry && (
        <EntryDetailDrawer
          formId={openEntry.formId}
          formName={openEntry.formName}
          entry={openEntry}
          /* ⚠️ Centred, like every other list in this product now — a result is read, and the two things
             that reading turns into are the buttons in the footer rather than a caption by the ✕. */
          container="dialog"
          permalink={
            activeSpaceSlug
              ? spaceSectionPath(activeSpaceSlug, `entry/${openEntry.formId}/${openEntry.id}`)
              : undefined
          }
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
