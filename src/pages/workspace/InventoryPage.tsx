import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useQueries, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowUpRight, Pencil } from "lucide-react"
import { Badge, Button, type FilterItem, FilterPanel, Input, Skeleton, cn } from "@jmouse/ui"
import { LevelDoor, LevelDoors } from "@/components/LevelDoor"
import { PageHeader } from "@/components/PageHeader"
import { ViewBar } from "@/components/ViewBar"
import { ToggleChip } from "@/components/ToggleChip"
import { QueryPanel, type AppliedQuery } from "@jmouse/query"
import { entriesOf } from "@/components/query/subjects"
import { QUERY_LABELS } from "@/components/query/labels"
import { Pagination } from "@/components/Pagination"
import { EntryDetailDrawer } from "@/components/form/EntryDetailDrawer"
import { StockSummaryStrip } from "@/components/inventory/StockSummaryStrip"
import { CadWorkbench } from "@/components/cad/CadWorkbench"
import { FieldValue } from "@/components/form/FieldValue"
import { formsApi } from "@/api/forms"
import type { SpaceForm } from "@/api/spaces"
import {
  useCreateEntry,
  useDeleteEntry,
  useEntriesByPurpose,
  useEntries,
  useEntryCounts,
  useUpdateEntry,
  useWorkspaceForms,
} from "@/hooks/useWorkspaceForms"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { relativeTime } from "@/lib/dates"
import { readFormConfigs, type FormConfigs } from "@/lib/formConfigs"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useSpaceNavigation } from "@/hooks/useSpaces"
import { useViewFromAddress } from "@/hooks/useViewFromAddress"
import { useSpaceStore } from "@/stores/spaceStore"
import type { FieldDetail, FormDetail, FormEntry } from "@/types"

const PAGE_SIZE = 25

/**
 * What this workspace actually holds, one row per thing.
 *
 * ⚠️ **Stock and catalogue share the machinery and not the meaning.** *Inventory* counts what is on the
 * shelf; *Parts catalog* records what a part **is**, whether or not one is in a drawer. One component,
 * two purposes, two routes — and the navigation never bounces somebody from one to the other, because
 * arriving at a catalogue and being shown stock is being shown the wrong question's answer.
 *
 * ⚠️ **This is the high level, and it stays there.** Nothing here edits a schema: which columns show,
 * what counts as quantity and what a row is called are all read out of the form's configuration, and the
 * way to change any of them is the door down to the builder. See {@link LevelDoor}.
 *
 * ⚠️ **"All types" is a different query, not a merge.** Rows from thirty forms cannot be paged by asking
 * each form for its own page — so the purpose-wide endpoint answers it, and the columns collapse to what
 * every form has in common. Picking one type is what earns the type's own columns.
 */
export function InventoryPage({
  purposeCode = "INVENTORY",
  companionPurposeCodes = [],
  title = "Inventory",
  noun = "component",
}: {
  purposeCode?: string
  /**
   * ⚠️ **Further purposes whose types appear in the rail beside this screen's own.**
   *
   * <p>One menu entry can cover more than one kind of thing when they are the same question asked
   * about different things — a catalogue of parts and a catalogue of the drawings those parts are
   * placed as. The rail is what tells them apart, and a second menu entry for each new kind is how a
   * menu stops being one.
   *
   * ⚠️ **They widen the rail and nothing else.** The screen's own identity — which saved views belong
   * to it, which other faces it offers a door to, what "everything" means — stays the primary purpose.
   * Merging the row lists would page two unlike things together and collapse the columns to what a
   * part and a footprint have in common, which is almost nothing.
   */
  companionPurposeCodes?: string[]
  title?: string
  noun?: string
} = {}) {
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId)

  /**
   * ⚠️ **This screen is generic — it also renders the parts catalogue — so it must not name an
   * electronics one.** It used to hard-code a door to `component-types` labelled "Component types and
   * their schemas" — in a file whose own header says it stays at the high level. The subject area
   * declares where a purpose is seen; this renders what it is handed and names nothing.
   */
  const { data: navigation } = useSpaceNavigation(activeSpaceId ?? undefined)
  /**
   * ⚠️ **The section a view belongs to is the ADDRESS, not the purpose.** This one component renders
   * both Inventory and the parts catalogue, and a view saved on one must not be offered on the other —
   * they answer different questions about the same machinery.
   */
  const section = purposeCode === "INVENTORY" ? "inventory" : "catalog"

  /**
   * ⚠️ **Every face except this screen's own.** A door from Inventory back to Inventory is a control that
   * leads where somebody already is; the same purpose now declares several, and the useful ones are the
   * others.
   */
  const doors = (navigation?.presentations?.[purposeCode] ?? [])
    .filter((face) => face.section !== section)
    .map((face) => ({ label: face.label, to: spaceSlug ? spaceSectionPath(spaceSlug, face.section) : "" }))

  /**
   * Which type is open, what was typed, and which page — **in the address**.
   *
   * ⚠️ **This is what makes Back work, and the Back button was never the problem.** These three lived in
   * `useState`, so every address for this screen was the same address: leaving for a record and coming
   * back landed on *All types*, page one, nothing typed. It read as a broken button and was a screen
   * that had never written down where somebody was.
   *
   * ⚠️ **And it makes the list quotable.** "The resistors, page three" is now something to paste into a
   * message, exactly as one record already was.
   *
   * ⚠️ **The page is 1-based in the address and 0-based in the code.** `?page=1` is the first page to
   * everybody who is not a programmer, and it is omitted rather than written — an address carrying
   * `?page=1&q=` says a filter is on when none is.
   */
  const [parameters, setParameters] = useSearchParams()

  const selectedFormId = parameters.get("type")
  const search = parameters.get("q") ?? ""
  const numberedPage = Number.parseInt(parameters.get("page") ?? "", 10)
  const page = Number.isFinite(numberedPage) && numberedPage > 1 ? numberedPage - 1 : 0

  /**
   * ⚠️ **One write for however many keys change.** Two `setParameters` calls in a row both read the
   * same stale `parameters`, so the second silently undoes the first — which is exactly what happens
   * when picking a type also has to reset the page.
   *
   * ⚠️ **`replace` by default.** Typing pushes a history entry per keystroke otherwise, and Back then
   * walks backwards through a search term one letter at a time instead of leaving the screen. Choosing
   * a type is the one deliberate move here, so that one pushes.
   */
  function amend(changes: Record<string, string | null>, options?: { push?: boolean }) {
    const next = new URLSearchParams(parameters)

    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") {
        next.delete(key)
      } else {
        next.set(key, value)
      }
    }

    setParameters(next, { replace: !options?.push })
  }

  const setPage = (next: number) => amend({ page: next <= 0 ? null : String(next + 1) })

  const [jmq, setJmq] = useState<AppliedQuery>({})
  const [composing, setComposing] = useState(false)
  const [editing, setEditing] = useState<{
    entry: FormEntry | null
    formId: string
    /** What a NEW row starts with — read only when there is no entry. */
    initialValues?: Record<string, string>
    /** What those seeded answers are called, for the fields whose choices come from a source. */
    initialOptionLabels?: Record<string, Record<string, string>>
    /**
     * Opened by a control that says *edit*, so it opens centred and already in the editor.
     *
     * ⚠️ **Set only by the row's own Edit button.** A row click goes to the record's page now; the
     * drawer is no longer what a list opens, so the one thing left that opens a form over this screen
     * is a control that announced it would.
     */
    asEditor?: boolean
    /**
     * Opened by a row click: centred, and showing the record rather than the form.
     *
     * ⚠️ **Told apart from `asEditor` because the two are different acts**, even though both are
     * modals — one is a glance somebody carries on from, the other is a change they came to make.
     */
    asPreview?: boolean
  } | null>(null)
  const [activeViewId, setActiveViewId] = useState<string | null>(null)

  /**
   * ⚠️ **Memoised, because it is a query key.** An array literal rebuilt on every render is a new key
   * every render — the request would repeat forever while the screen looked entirely correct.
   */
  const railPurposeCodes = useMemo(
    () => [purposeCode, ...companionPurposeCodes],
    [purposeCode, companionPurposeCodes.join(",")],
  )

  const { data: forms = [], isLoading: formsLoading } = useWorkspaceForms(railPurposeCodes)

  /**
   * ⚠️ **"Everything" means everything of THIS screen's purpose, and the label has to say so.** With a
   * companion purpose in the rail, "All types" would promise the footprints too and deliver only the
   * parts — a label that is wrong in the one place somebody checks whether the filter is on.
   */
  const allTypesLabel = companionPurposeCodes.length > 0 ? `All ${noun}s` : "All types"

  /**
   * A workspace switch has to forget which type was open — the id belongs to the workspace we left, and
   * so does anything typed about it.
   *
   * ⚠️ **Only on a CHANGE, never on the first run — and the difference used to be invisible.** While
   * these lived in `useState` the effect cleared values that were already empty, so firing on mount cost
   * nothing. Now they come from the address, and clearing on mount wipes the very `?type=` somebody just
   * came back to: Back appeared to land on *All types* again, for a completely different reason than the
   * one that was just fixed.
   */
  const lastSpaceId = useRef(activeSpaceId)

  useEffect(() => {
    if (lastSpaceId.current === activeSpaceId) {
      return
    }

    lastSpaceId.current = activeSpaceId
    amend({ type: null, page: null, q: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSpaceId])

  const isAllTypes = selectedFormId === null

  /**
   * ⚠️ **Every form's *detail*, not its summary.** The summary carries no configuration and no fields,
   * and both are what decide the columns. One query per form, cached for five minutes: they are schemas,
   * so they change when somebody edits one, not while a table is being read.
   */
  const detailQueries = useQueries({
    queries: forms.map((form) => ({
      queryKey: ["forms", form.id] as const,
      queryFn: () => formsApi.get(form.id).then((response) => response.data),
      staleTime: 5 * 60_000,
    })),
  })

  const details = useMemo(() => {
    const byId: Record<string, FormDetail> = {}

    forms.forEach((form, index) => {
      const detail = detailQueries[index]?.data

      if (detail) {
        byId[form.id] = detail
      }
    })

    return byId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forms, detailQueries.map((query) => query.dataUpdatedAt).join(",")])

  /**
   * ⚠️ **Whether the rows in view are drawings** — decided by the selected type's PURPOSE, never by a
   * form id, so a second CAD catalogue is treated the same with nothing here to update.
   *
   * ⚠️ And only when one type is selected: a mixed page has no single shape to take, so it stays a table.
   */
  const showsDrawings = selectedFormId !== null && details[selectedFormId]?.purpose?.code === "CAD"

  /**
   * Which type a new file is recorded against.
   *
   * ⚠️ **Not in the rail, and that is deliberate** — files are seen through the drawing they belong to,
   * never as a loose list — so this screen has to look the form up for itself. The first one, because a
   * workspace with two file types has a question nobody has asked yet and guessing an answer here would
   * be the wrong place to answer it.
   */
  const { data: cadFileForms = [] } = useWorkspaceForms("CAD_FILE", { enabled: showsDrawings })
  const cadFilesFormId = cadFileForms[0]?.id ?? null

  /**
   * The CAD Files type's own schema.
   *
   * ⚠️ **Asked for on its own, because the rail is not the list of forms this screen edits.** Every other
   * schema arrives with the rail; this one is deliberately absent from it, so a lookup built from the rail
   * has nothing under its id — and an editor with no schema does not fail, it simply never renders. The
   * button reads as dead, with no error anywhere to say why.
   */
  const { data: cadFilesForm = null } = useQuery({
    queryKey: ["forms", cadFilesFormId],
    queryFn: () => formsApi.get(cadFilesFormId!).then((response) => response.data),
    enabled: cadFilesFormId !== null,
    staleTime: 5 * 60_000,
  })

  /** Every schema this screen can open an editor on — the rail's, plus the file type that is not in it. */
  const editableForms = useMemo(
    () => (cadFilesForm ? { ...details, [cadFilesForm.id]: cadFilesForm } : details),
    [details, cadFilesForm],
  )

  const activeForm = selectedFormId ? (details[selectedFormId] ?? null) : null

  // ⚠️ Debounced, because this one is a SERVER filter — otherwise it is a request per keystroke over a
  // table that may hold thousands of rows.
  const query = useDebouncedValue(search.trim(), 300)

  const { data: onePage, isLoading: oneLoading } = useEntries(
    selectedFormId ?? undefined,
    page,
    PAGE_SIZE,
    query,
    jmq,
  )
  const { data: everyPage, isLoading: everyLoading } = useEntriesByPurpose(
    isAllTypes ? purposeCode : undefined,
    page,
    PAGE_SIZE,
    { query },
  )

  const entriesPage = isAllTypes ? everyPage : onePage
  const isLoading = isAllTypes ? everyLoading : oneLoading
  const entries = entriesPage?.content ?? []

  const { data: counts = {} } = useEntryCounts(forms.map((form) => form.id))

  const createEntry = useCreateEntry()
  const updateEntry = useUpdateEntry()
  const deleteEntry = useDeleteEntry()

  /**
   * ⚠️ **The search reaches the database now, so nothing is filtered here.** It used to narrow the
   * twenty-five rows already fetched — honest about it, and nearly useless: a workspace with eight
   * hundred components could not find one. The query goes to the server, matches everything written on
   * an entry rather than one nominated field, and the count under the title is the real one.
   */
  const visible = entries

  const total = Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0)

  const filterItems: FilterItem[] = forms.map((form) => ({
    key: form.id,
    icon: form.icon ?? form.category?.icon ?? "◫",
    label: form.codename ?? form.name,
    count: counts[form.id] ?? 0,
  }))

  function select(formId: string | null) {
    // ⚠️ Pushed, not replaced: picking a type is a move somebody may want to take back.
    amend({ type: formId, page: null }, { push: true })
    // Narrowing by hand un-claims the view: the filter is no longer what it stored.
    setActiveViewId(null)
  }

  useViewFromAddress<{ formId?: string | null; search?: string }>(section, (applied, viewId) => {
    amend({ type: applied.formId ?? null, q: applied.search ?? null, page: null })
    setActiveViewId(viewId)
  })

  const activeLabel = activeForm ? (activeForm.codename ?? activeForm.name) : allTypesLabel
  const editedForm = editing ? (editableForms[editing.formId] ?? null) : null

  return (
    <>
      <PageHeader
        title={title}
        description={`${activeLabel} — ${entriesPage?.totalElements ?? 0} recorded`}
        actions={
          <>
            {/*
              ⚠️ `size="sm"` is the row's size, and every control here now takes it. This said
              `h-8 … text-sm` — thirty-two pixels and a fourteen-pixel face, next to a chip at
              thirty-two and a button at thirty, so three controls stood at two heights and two type
              sizes. None of the three was wrong on its own; what was missing was a shared knob, which
              `Input` now has.
            */}
            <Input
              size="sm"
              className="w-64"
              value={search}
              placeholder={`Search every ${noun}…`}
              onChange={(event) => {
                // One write: typing also returns to the first page, and two calls would fight.
                amend({ q: event.target.value, page: null })
                setActiveViewId(null)
              }}
            />
            {/* ⚠️ Disabled rather than hidden while no type is chosen: a control that appears once you
                pick something reads as *it was not there a moment ago*, and the reason it cannot be used
                is worth stating rather than hiding. */}
            <ToggleChip
              active={composing}
              disabled={!selectedFormId}
              title={selectedFormId ? undefined : `Choose a type first — its fields are what a filter names`}
              onClick={() => setComposing((previous) => !previous)}
            >
              Filter
            </ToggleChip>

            <Button
              size="sm"
              disabled={forms.length === 0}
              onClick={() => setEditing({ entry: null, formId: selectedFormId ?? forms[0]?.id ?? "" })}
            >
              Add {noun}
            </Button>
          </>
        }
      />

      {/*
        ⚠️ Below the header rather than in a drawer: a filter somebody is composing and the rows it will
        narrow belong on one screen. A panel that covered the list would make every adjustment a guess.

        ⚠️ Only once a type is chosen. `entries` has no vocabulary of its own — what may be named comes
        from the FORM, so offering the builder over "all types" would offer an empty one, which reads as
        *this has no fields* rather than as *pick a type first*.
      */}
      {selectedFormId && composing && (
        <QueryPanel
          subject={entriesOf(selectedFormId)}
          query={jmq}
          labels={QUERY_LABELS}
          onApply={(applied) => {
            setJmq(applied)
            setPage(0)
            setActiveViewId(null)
          }}
        />
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <FilterPanel
          title="Types"
          items={filterItems}
          activeKey={selectedFormId}
          onSelect={select}
          allLabel={allTypesLabel}
          allIcon="☰"
          allCount={total}
          searchable={filterItems.length > 8}
          searchPlaceholder="Filter the types…"
          footer={
            spaceSlug && doors.length > 0 ? <LevelDoors doors={doors} /> : undefined
          }
        />

        <div className="flex min-w-0 flex-col gap-3">
          {/* ⚠️ Above the filters and outside them, because it answers a different question. What the
              workspace holds is a fact about the workspace; what the list below shows is a fact about
              whatever has been typed into the search box. A figure that moved with the filter would be
              read as the whole and be wrong — the breakdown inside it is how one type is asked. */}
          <StockSummaryStrip purposeCode={purposeCode} noun={noun} selectedFormId={selectedFormId} />

          <ViewBar
            section={section}
            filter={{ formId: selectedFormId, search }}
            isFiltered={Boolean(selectedFormId || search.trim())}
            activeViewId={activeViewId}
            onApply={(applied, viewId) => {
              amend({ type: applied.formId ?? null, q: applied.search ?? null, page: null })
              setActiveViewId(viewId)
            }}
          />

          {formsLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : forms.length === 0 ? (
            <EmptyState
              glyph="🗂️"
              title={`Nothing to record ${noun}s against`}
              detail={`A ${noun} is recorded against a type — a form carrying the ${purposeCode.toLowerCase()} purpose. This workspace shows none yet.`}
              action={
                spaceSlug ? (
                  <LevelDoor
                    label="Open the form library"
                    to={spaceSectionPath(spaceSlug, "forms")}
                  />
                ) : undefined
              }
            />
          ) : isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : visible.length === 0 ? (
            <EmptyState
              glyph="📦"
              title={search ? "Nothing on this page matches" : `No ${noun}s yet`}
              detail={
                search
                  ? "The search looks at the rows in hand — try another page, or narrow by type first."
                  : isAllTypes
                    ? `Record one against any type and it shows up here.`
                    : `Nothing has been recorded against ${activeLabel} yet.`
              }
              action={
                !isAllTypes && !search ? (
                  <Button size="sm" onClick={() => setEditing({ entry: null, formId: selectedFormId! })}>
                    Add {noun}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="flex flex-col overflow-hidden rounded-md border">
              {/*
                ⚠️ **A drawing is looked at, a part is read.** A footprint is told apart from the one
                beside it by its shape, not by the tail of its name — so the CAD types render as tiles
                while everything else stays the table it has always been. The switch is on the selected
                type's PURPOSE, never on a form id: a second CAD catalogue gets the same treatment with
                nothing here to update, and "all types" keeps the table because a mixed page has no one
                shape to take.
              */}
              {showsDrawings ? (
                <CadWorkbench
                  entries={visible}
                  onOpen={(entry) => setEditing({ entry, formId: entry.formId })}
                  onAddFile={(drawing) => {
                    /*
                      ⚠️ **The file form, with the drawing already chosen.** Its `cad_drawing` is a
                      REQUIRED select, so arriving at an empty one from a drawing's own screen would ask
                      somebody to answer a question they have just answered by being there.
                    */
                    if (!cadFilesFormId) {
                      toast.error("This workspace has no CAD Files type — add it in the form library.")
                      return
                    }

                    setEditing({
                      entry: null,
                      formId: cadFilesFormId,
                      initialValues: { cad_drawing: drawing.id },
                      /* ⚠️ The name goes with the id. The select fetches its choices only while the
                         picker is open, so a seeded value with no label reads as ‹deleted› — about the
                         very drawing whose screen this was opened from. */
                      initialOptionLabels: {
                        cad_drawing: {
                          [drawing.id]: drawing.fieldValues?.cad_identifier ?? drawing.id,
                        },
                      },
                    })
                  }}
                />
              ) : (
                <EntriesTable
                  entries={visible}
                  forms={forms}
                  details={details}
                  activeForm={activeForm}
                  pageOf={(entry) =>
                    spaceSlug ? spaceSectionPath(spaceSlug, `entry/${entry.formId}/${entry.id}`) : null
                  }
                  onPreview={(entry) => setEditing({ entry, formId: entry.formId, asPreview: true })}
                  onEdit={(entry) => setEditing({ entry, formId: entry.formId, asEditor: true })}
                />
              )}

              {entriesPage && entriesPage.totalPages > 1 && (
                <Pagination
                  page={page}
                  totalPages={entriesPage.totalPages}
                  totalElements={entriesPage.totalElements}
                  size={entriesPage.size}
                  onChange={setPage}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {editing && editedForm && (
        <EntryDetailDrawer
          formId={editing.formId}
          formName={editedForm.name}
          permalink={
            spaceSlug && editing.entry
              ? spaceSectionPath(spaceSlug, `entry/${editing.formId}/${editing.entry.id}`)
              : undefined
          }
          entry={editing.entry ?? undefined}
          initialValues={editing.initialValues}
          initialOptionLabels={editing.initialOptionLabels}
          isNew={!editing.entry}
          /* ⚠️ Centred for both, but only Edit opens IN the editor — the row said Edit, so landing on
             the record and asking somebody to press Edit again would be the screen ignoring what they
             just pressed. A row click lands on the record, which is what it asked for. */
          container={editing.asEditor || editing.asPreview ? "dialog" : undefined}
          startInEdit={editing.asEditor}
          isSubmitting={createEntry.isPending || updateEntry.isPending}
          onSubmit={async (values) => {
            if (editing.entry) {
              await updateEntry.mutateAsync({
                formId: editing.formId,
                entryId: editing.entry.id,
                fieldValues: values,
              })
              toast.success("Saved.")
            } else {
              await createEntry.mutateAsync({ formId: editing.formId, fieldValues: values })
              toast.success("Recorded.")
            }

            setEditing(null)
          }}
          onDelete={
            editing.entry
              ? () => {
                  deleteEntry.mutate(
                    { formId: editing.formId, entryId: editing.entry!.id },
                    { onSuccess: () => toast.success("Deleted.") },
                  )
                  setEditing(null)
                }
              : undefined
          }
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

function EmptyState({
  glyph,
  title,
  detail,
  action,
}: {
  glyph: string
  title: string
  detail: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
      <span aria-hidden="true" className="text-2xl">
        {glyph}
      </span>
      <span className="text-sm font-medium">{title}</span>
      <span className="max-w-md text-xs text-muted-foreground">{detail}</span>
      {action && <span className="mt-2">{action}</span>}
    </div>
  )
}

/**
 * The rows, in whatever columns the chosen type asks for.
 *
 * ⚠️ **Columns come from the form's configuration, in one order of preference:** an explicit
 * `display.table_columns` wins outright; failing that the title, subtitle and highlighted fields in that
 * order; failing that the first six non-composite fields. The last of those is a guess and is meant to
 * be — a table with no columns is worse than a table with the wrong six, and the wrong six are visibly
 * wrong, which is what sends somebody to the settings that fix them.
 */
function EntriesTable({
  entries,
  forms,
  details,
  activeForm,
  pageOf,
  onPreview,
  onEdit,
}: {
  entries: FormEntry[]
  forms: SpaceForm[]
  details: Record<string, FormDetail>
  activeForm: FormDetail | null
  /**
   * Where a row lives on its own — for the control that says so, not for the row itself.
   *
   * ⚠️ Answers `null` only while the workspace slug is still resolving, and a row with nowhere to go
   * simply does not offer the control.
   */
  pageOf: (entry: FormEntry) => string | null
  /**
   * ⚠️ **A row click opens a PREVIEW, centred, and neither edits nor navigates.** Somebody scanning a
   * list wants to look at a row and carry on scanning: a side panel left half the window showing a list
   * nobody was reading, and going straight to the page threw the list away for a glance. The preview
   * carries the two things that glance turns into — *Edit* and *Open in full page* — as buttons that
   * say which is which.
   */
  onPreview: (entry: FormEntry) => void
  /** ⚠️ Straight into the editor, because the control that opened it said Edit. */
  onEdit: (entry: FormEntry) => void
}) {
  const isAllTypes = !activeForm
  const configs = readFormConfigs(activeForm?.config)

  const imageField = configs.imageField
  const priorityFields = configs.priorityFields

  const columns: FieldDetail[] = useMemo(() => {
    if (!activeForm) {
      return []
    }

    const byName = new Map(activeForm.fields.map((field) => [field.name, field]))
    const named = configs.tableColumns.length > 0 ? configs.tableColumns : orderedDisplayNames(configs, imageField)

    if (named.length > 0) {
      return named.map((name) => byName.get(name)).filter((field): field is FieldDetail => !!field)
    }

    return activeForm.fields.filter((field) => field.usageType !== "VIRTUAL").slice(0, 6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeForm])

  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-[10px] tracking-[0.06em] text-muted-foreground uppercase">
            <th className="px-2.5 py-1.5 text-left font-medium">Type</th>
            {imageField && <th className="w-12 px-2.5 py-1.5" />}
            {columns.map((field) => (
              <th
                key={field.id}
                className={cn("px-2.5 py-1.5 text-left font-medium", priorityFields.includes(field.name) && "text-foreground")}
              >
                {field.icon ? `${field.icon} ` : ""}
                {field.label}
              </th>
            ))}
            {isAllTypes && <th className="px-2.5 py-1.5 text-left font-medium">Entry</th>}
            <th className="px-2.5 py-1.5 text-left font-medium">Updated</th>
            {/* ⚠️ Unlabelled on purpose — a column of controls is read by its buttons, and "Actions"
                over two icons is a heading that describes the table rather than the data in it. */}
            <th className="w-px px-2.5 py-1.5" />
          </tr>
        </thead>

        <tbody>
          {entries.map((entry) => {
            const summary = forms.find((form) => form.id === entry.formId)
            const detail = details[entry.formId] ?? null
            const rowConfigs = readFormConfigs(detail?.config)

            // ⚠️ Low stock is a fact about the row and is marked on the row, not in a column somebody
            // has to think to add — the whole reason to look at a stock table is to find these.
            const quantity = numberAt(entry, rowConfigs.stockQuantityField)
            const threshold = numberAt(entry, rowConfigs.stockThresholdField)
            const isLow = quantity !== null && threshold !== null && quantity < threshold

            const page = pageOf(entry)

            return (
              <tr
                key={entry.id}
                onClick={() => onPreview(entry)}
                className={cn(
                  "group cursor-pointer border-b transition-colors last:border-b-0 hover:bg-accent",
                  isLow && "border-l-2 border-l-destructive bg-destructive/5",
                )}
              >
                <td className="px-2.5 py-1.5">
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {summary?.codename ?? summary?.name?.slice(0, 8).toUpperCase() ?? "—"}
                  </Badge>
                </td>

                {imageField && (
                  <td className="px-2.5 py-1.5">
                    <FieldValue value={entry.fieldValues[imageField] ?? ""} elementType="IMAGE" />
                  </td>
                )}

                {columns.map((field) => (
                  <td key={field.id} className="max-w-64 truncate px-2.5 py-1.5">
                    <FieldValue
                      value={entry.fieldValues[field.name] ?? ""}
                      elementType={field.elementType}
                      unit={field.unit}
                      options={withResolvedLabels(field, entry)}
                      children={childSegments(field, entry)}
                    />
                  </td>
                ))}

                {isAllTypes && (
                  <td className="max-w-80 truncate px-2.5 py-1.5">{titleOf(entry, rowConfigs)}</td>
                )}

                <td className="px-2.5 py-1.5 text-xs text-muted-foreground">{relativeTime(entry.updatedAt)}</td>

                {/* ⚠️ **`stopPropagation`, or every control here also opens the page behind it.** The
                    row is the link; these sit on top of it and mean something else. */}
                <td className="px-2.5 py-1.5" onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-center justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Edit this row"
                      aria-label="Edit this row"
                      onClick={() => onEdit(entry)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>

                    {/* ⚠️ A real link, not a second way to fire the row's click. Middle-click and
                        "open in a new tab" are how somebody compares two rows, and a handler that only
                        calls `navigate` takes both away. */}
                    {page && (
                      <Button asChild variant="ghost" size="icon-sm">
                        <Link to={page} title="Open its page" aria-label="Open its page">
                          <ArrowUpRight className="size-3.5" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** The title, subtitle and highlighted fields, deduplicated, with the thumbnail's field left out of them. */
function orderedDisplayNames(configs: FormConfigs, imageField: string | null): string[] {
  const ordered: string[] = []

  for (const name of [configs.primaryField, configs.secondaryField, ...configs.priorityFields]) {
    if (name && name !== imageField && !ordered.includes(name)) {
      ordered.push(name)
    }
  }

  return ordered
}

/** ⚠️ Falls back to the first value the row happens to carry — a row with no name is still a row. */
function titleOf(entry: FormEntry, configs: FormConfigs): string {
  const named = configs.primaryField ? entry.fieldValues[configs.primaryField] : undefined

  return named || Object.values(entry.fieldValues)[0] || "—"
}

function numberAt(entry: FormEntry, fieldName: string | null): number | null {
  if (!fieldName) {
    return null
  }

  const parsed = Number.parseFloat(entry.fieldValues[fieldName] ?? "")

  return Number.isNaN(parsed) ? null : parsed
}

/**
 * ⚠️ **What a *sourced* value reads as comes with the entry, not with the field.** A field drawing its
 * choices from another form has no static options at all, so its label lives in the row's `optionLabels`
 * — folded in here so no renderer below has to learn what a reference is.
 */
function withResolvedLabels(field: FieldDetail, entry: FormEntry) {
  const resolved = entry.optionLabels?.[field.name]

  if (!resolved) {
    return field.options
  }

  const merged = field.options.map((option) => ({
    ...option,
    optionLabel: resolved[option.optionValue] ?? option.optionLabel,
  }))

  const known = new Set(merged.map((option) => option.optionValue))

  return [
    ...merged,
    ...Object.entries(resolved)
      .filter(([value]) => !known.has(value))
      .map(([optionValue, optionLabel]) => ({ optionValue, optionLabel })),
  ]
}

function childSegments(field: FieldDetail, entry: FormEntry) {
  const isComposite = field.elementType === "COMPLEX_COMPOSITE" || field.elementType === "NONE"

  if (!isComposite) {
    return undefined
  }

  return (field.children ?? []).map((child) => ({
    label: child.label,
    unit: child.unit,
    value: entry.fieldValues[child.name] ?? "",
  }))
}
