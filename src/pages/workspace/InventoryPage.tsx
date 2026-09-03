import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQueries, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowDownUp, ArrowUpRight, Pencil } from "lucide-react"
import {
  Badge,
  Button,
  DetailsPanel,
  type FilterItem,
  Input,
  PageState,
  Skeleton,
  type ListKeyboard,
  cn,
  useDetailsPanel,
  useKeyboardShortcuts,
  useListKeyboard,
} from "@jmouse/ui"
import { LevelDoor, LevelDoors } from "@/components/LevelDoor"
import { ListScreen } from "@/components/layout/ListScreen"
import { ViewBar } from "@/components/ViewBar"
import { ToggleChip } from "@/components/ToggleChip"
import { QueryPanel } from "@jmouse/query"
import { entriesOf } from "@/components/query/subjects"
import { QUERY_LABELS } from "@/components/query/labels"
import { EntryDetailDrawer } from "@/components/form/EntryDetailDrawer"
import { StockSummaryStrip } from "@/components/inventory/StockSummaryStrip"
import { AdjustQuantityDialog } from "@/components/inventory/AdjustQuantityDialog"
import { LabelPrintButton } from "@/components/labels/LabelPrintButton"
import { CadWorkbench } from "@/components/cad/CadWorkbench"
import { FieldValue } from "@/components/form/FieldValue"
import { FilterableValue } from "@/components/form/FilterableValue"
import { formsApi } from "@/api/forms"
import type { SpaceForm } from "@/api/spaces"
import type { PartTotal } from "@/api/stock"
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
import { usePartReservations, usePartTotals, useStockPositions, useStockSummary } from "@/hooks/useStock"
import { LoadFailureNotice } from "@/components/LoadFailureNotice"
import { describeQueryFailure } from "@/lib/loadFailure"
import { relativeTime } from "@/lib/dates"
import { optionsWithLabels } from "@/lib/entryLabels"
import { readFormConfigs, type FormConfigs } from "@/lib/formConfigs"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useSpaceNavigation } from "@/hooks/useSpaces"
import { useViewFromAddress } from "@/hooks/useViewFromAddress"
import { useAddress } from "@/hooks/useAddress"
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
  ownSection,
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
  /**
   * The workspace section this screen IS, as the menu names it.
   *
   * ⚠️ Needed because the same component now renders three faces, and only the caller knows which one
   * it was mounted as — see the note on `section` below.
   */
  ownSection?: string
} = {}) {
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)
  const navigate = useNavigate()
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
  /**
   * ⚠️ **Handed in, because this screen cannot work it out any more.** It was derived from the purpose
   * — `INVENTORY` meant `inventory`, everything else meant `catalog` — which was true while there were
   * two faces. A third arrived (`cad`), and the derivation quietly answered `catalog` for it: the door
   * filter below then failed to recognise the screen's own face, so the CAD screen offered a door
   * labelled *Seen in the CAD catalogue* that led back to itself.
   *
   * <p>Nothing errored, because a door to where you already are is a valid link.
   */
  const section = ownSection ?? (purposeCode === "INVENTORY" ? "inventory" : "catalog")

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
  const { parameters, amend, query: jmq, setQuery: setJmq } = useAddress()

  const selectedFormId = parameters.get("type")
  const search = parameters.get("q") ?? ""

  /**
   * ⚠️ **In the address like everything else on this screen**, so "what should I order" is a link
   * somebody can send rather than a state they have to reproduce. It narrows on the server — filtering
   * the twenty-five rows already fetched would answer about a page rather than about the shelf.
   */
  const lowOnly = parameters.get("low") === "1"
  const numberedPage = Number.parseInt(parameters.get("page") ?? "", 10)
  const page = Number.isFinite(numberedPage) && numberedPage > 1 ? numberedPage - 1 : 0

  const setPage = (next: number) => amend({ page: next <= 0 ? null : String(next + 1) })

  const [composing, setComposing] = useState(false)

  /**
   * The box whose quantity is being changed, if any.
   *
   * ⚠️ **Its own state rather than a mode of the drawer.** A quantity does not move by editing a
   * record — the form's quantity field is read-only and the backend refuses a direct write — so this
   * is a different act with a different door, and folding it into the editor would put the one thing
   * the editor cannot do inside the editor.
   */
  const [adjusting, setAdjusting] = useState<FormEntry | null>(null)

  /**
   * The rows somebody has ticked.
   *
   * ⚠️ **Cleared whenever the list underneath changes.** A selection that survives a filter is a
   * selection about rows nobody can see any more — and the one thing it is for, printing labels, then
   * prints a stack for a shelf somebody is not standing at.
   */
  const [selected, setSelected] = useState<Set<string>>(new Set())

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
   * ⚠️ **On Inventory the rail lists PART types, not the form the rows are entries of.**
   *
   * Every position in a workspace lives on one form — "Inventory" — so a rail built from the rows'
   * own forms has exactly one item and narrows nothing. What somebody means by *the diodes* is the type
   * of the **part** each position names, two hops away, which is why the rail is fed from the stock
   * summary (already grouped by the part's form) and the listing comes from a stock route rather than
   * from the entries one.
   *
   * ⚠️ **So `?type=` means a different thing on the two sections this component renders**, and that is
   * deliberate: on the catalogue it is the row's own type, on Inventory it is the part's. Both read as
   * "which kind of component", which is the only thing a person is asking.
   */
  const isPositions = section === "inventory"

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
  /**
   * ⚠️ **Also true on a screen whose whole purpose IS drawings**, and not only when one type is picked.
   *
   * <p>The condition was written for the parts catalogue, where CAD types sat in a rail beside part
   * types — a mixed page has no single shape, so it stayed a table until somebody chose. On the CAD
   * screen there is nothing else: every type in the rail is a drawing type, and "All types" was showing
   * an empty table with the workbench — and CAD Files with it — reachable only by clicking a rail entry
   * nobody knew to click.
   */
  const showsDrawings =
      purposeCode === "CAD" || (selectedFormId !== null && details[selectedFormId]?.purpose?.code === "CAD")

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

  /**
   * Whose schema decides the columns.
   *
   * ⚠️ **On Inventory it is always the position form, whatever the rail says.** The rail there selects a
   * *part* type, and drawing a table of positions with a diode's columns would print a resistance
   * against a box. Every position is an entry of the one inventory form, so its schema is the only one
   * that describes what a row holds.
   */
  const activeForm = isPositions
    ? (details[forms[0]?.id ?? ""] ?? null)
    : selectedFormId
      ? (details[selectedFormId] ?? null)
      : null

  // ⚠️ Debounced, because this one is a SERVER filter — otherwise it is a request per keystroke over a
  // table that may hold thousands of rows.
  const query = useDebouncedValue(search.trim(), 300)

  const oneQuery = useEntries(
    selectedFormId ?? undefined,
    page,
    PAGE_SIZE,
    query,
    jmq,
  )
  const everyQuery = useEntriesByPurpose(
    isAllTypes ? purposeCode : undefined,
    page,
    PAGE_SIZE,
    { query },
  )

  /**
   * ⚠️ **Inventory always asks the stock route, filter or no filter.** The two answer the same rows when
   * nothing is narrowed, so switching between them by whether a filter happens to be on would make the
   * screen change its mind about where its rows come from — and the stock route is the one whose search
   * can find a part number, which the entries route cannot: a position stores its part as an identifier,
   * so typing `SS34` into the ordinary search matches nothing at all.
   */
  const positionsQuery = useStockPositions(
    { partFormId: selectedFormId ?? undefined, low: lowOnly || undefined, query: query || undefined },
    page,
    PAGE_SIZE,
    isPositions,
  )

  const entriesPage = isPositions ? positionsQuery.data : isAllTypes ? everyQuery.data : oneQuery.data
  const isLoading = isPositions ? positionsQuery.isLoading : isAllTypes ? everyQuery.isLoading : oneQuery.isLoading

  /**
   * ⚠️ **Which question failed, taken from the same branch that decided which one was asked.** Three
   * queries are declared and exactly one of them is live; describing all three would show a stale
   * failure from a route this screen is not using.
   */
  const liveQuery = isPositions ? positionsQuery : isAllTypes ? everyQuery : oneQuery
  const loadFailure = describeQueryFailure(liveQuery, `these ${noun}s`)
  const refetchEntries = liveQuery.refetch
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

  /**
   * The rail, and where its rows come from.
   *
   * ⚠️ **On Inventory it is the stock summary's own breakdown**, which is already grouped by the form of
   * each position's *part* — the same question, answered once, by the same query that draws the strip
   * above the table. Building it from the rows on screen would be a rail of whatever happens to be on
   * page one.
   */
  const { data: summary } = useStockSummary(isPositions)

  const filterItems: FilterItem[] = isPositions
    ? (summary?.byType ?? []).map((type) => ({
        key: type.formId,
        icon: type.icon ?? "◫",
        label: type.formName,
        count: type.rows,
      }))
    : forms.map((form) => ({
        key: form.id,
        icon: form.icon ?? form.category?.icon ?? "◫",
        label: form.codename ?? form.name,
        count: counts[form.id] ?? 0,
      }))

  const total = isPositions
    ? (summary?.rows ?? 0)
    : Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0)

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

  const activeLabel = isPositions
    ? (filterItems.find((item) => item.key === selectedFormId)?.label ?? allTypesLabel)
    : activeForm
      ? (activeForm.codename ?? activeForm.name)
      : allTypesLabel

  /**
   * Which schema a new row is written against.
   *
   * ⚠️ **Never the rail's selection on Inventory.** There the rail names a *part* type, and creating a
   * "position" on the Diodes form would file a component in the catalogue while the person believed
   * they were putting one on a shelf. A position always belongs to the one inventory form.
   */
  const formForNewRow = isPositions ? (forms[0]?.id ?? "") : (selectedFormId ?? forms[0]?.id ?? "")

  // ⚠️ Not `useEffect`: the rows change during the same render the filter does, and clearing a frame
  // later means one paint where the count says four and the table shows twelve different rows.
  const listedIds = entries.map((entry) => entry.id).join(",")
  const lastListed = useRef(listedIds)

  if (lastListed.current !== listedIds) {
    lastListed.current = listedIds
    if (selected.size > 0) {
      setSelected(new Set())
    }
  }

  function toggleSelected(entryId: string) {
    setSelected((previous) => {
      const next = new Set(previous)

      if (next.has(entryId)) {
        next.delete(entryId)
      } else {
        next.add(entryId)
      }

      return next
    })
  }

  /**
   * The keyboard, the rail, and the one place the search box can be focused from.
   *
   * <p>⚠️ **The rail is a PEEK, and the centred preview stays exactly as it was.** A row click still
   * opens the preview with its *Edit* and *Open in full page* buttons — that behaviour was decided
   * deliberately and is not this ticket's to remove. What the rail adds is the thing a keyboard needs
   * and a dialog cannot be: a look at the active row that leaves the list on screen and your place in
   * it, so `j j Space j Space` reads four rows without ever losing the table.
   *
   * <p>⚠️ Both surfaces existing is a real cost, and whether the click should become the rail too is
   * Ivan's call rather than a thing to decide by writing it.
   */
  // ⚠️ The two point at each other — closing the rail clears the active row, and the active row is what
  // opens the rail. One direction goes through a ref rather than being declared after the other, since
  // whichever is written second cannot be named by the first.
  const clearActiveRow = useRef<() => void>(() => {})
  const peek = useDetailsPanel<FormEntry>({ onClose: () => clearActiveRow.current() })
  const keyboard = useListKeyboard<FormEntry>({
    rows: visible,
    identify: (entry) => entry.id,
    // ⚠️ `Enter` opens the record's own page, never the preview — the preview is what a glance gets,
    // and somebody who pressed Enter has stopped glancing.
    onOpen: (entry) => {
      const page = spaceSlug ? spaceSectionPath(spaceSlug, `entry/${entry.formId}/${entry.id}`) : null

      if (page) {
        navigate(page)
      }
    },
    onShowDetails: (entry) => peek.show(entry),
    markable: true,
    onMarkedChange: (marked) => setSelected(new Set(marked)),
  })

  clearActiveRow.current = () => keyboard.setActive(null)

  const searchBox = useRef<HTMLInputElement>(null)

  useKeyboardShortcuts([
    {
      keys: "/",
      describes: "Search this list",
      group: "This list",
      run: () => searchBox.current?.focus(),
    },
    {
      keys: "n",
      describes: `Add ${noun}`,
      group: "This list",
      disabled: !formForNewRow,
      run: () => setEditing({ entry: null, formId: formForNewRow! }),
    },
    {
      keys: "j",
      describes: "Next row",
      group: "This list",
      run: () => keyboard.move(1),
    },
    {
      keys: "k",
      describes: "Previous row",
      group: "This list",
      run: () => keyboard.move(-1),
    },
  ])
  const editedForm = editing ? (editableForms[editing.formId] ?? null) : null

  return (
    <>
      <ListScreen
        title={title}
        description={`${activeLabel} — ${entriesPage?.totalElements ?? 0} recorded`}
        extraActions={
          <>
            {/*
              ⚠️ `size="sm"` is the row's size, and every control here now takes it. This said
              `h-8 … text-sm` — thirty-two pixels and a fourteen-pixel face, next to a chip at
              thirty-two and a button at thirty, so three controls stood at two heights and two type
              sizes. None of the three was wrong on its own; what was missing was a shared knob, which
              `Input` now has.
            */}
            <Input
              ref={searchBox}
              size="sm"
              className="w-64"
              value={search}
              placeholder={`Search every ${noun}… ( / )`}
              onChange={(event) => {
                // One write: typing also returns to the first page, and two calls would fight.
                amend({ q: event.target.value, page: null })
                setActiveViewId(null)
              }}
            />
            {/* ⚠️ **The one question this screen exists to answer quickly**, so it is a chip beside the
                search rather than a saved view somebody has to know about. It narrows on the server:
                the boxes under their minimum are not necessarily on the page in front of you.

                Only on Inventory — a catalogue part carries no quantity, so there is nothing for it to
                be under. */}
            {isPositions && (
              <ToggleChip
                active={lowOnly}
                title="Boxes holding less than the minimum written on them"
                onClick={() => amend({ low: lowOnly ? null : "1", page: null }, { push: true })}
              >
                Below minimum
                {(summary?.lowPositions ?? 0) > 0 && (
                  <span className="ml-1.5 tabular-nums opacity-70">{summary?.lowPositions}</span>
                )}
              </ToggleChip>
            )}

            {/* ⚠️ Disabled rather than hidden while no type is chosen: a control that appears once you
                pick something reads as *it was not there a moment ago*, and the reason it cannot be used
                is worth stating rather than hiding.

                ⚠️ And never on Inventory, where the rail selects a PART type — the fields a filter would
                name belong to the position form, which the rail is no longer about. */}
            {!isPositions && (
              <ToggleChip
                active={composing}
                disabled={!selectedFormId}
                title={selectedFormId ? undefined : `Choose a type first — its fields are what a filter names`}
                onClick={() => setComposing((previous) => !previous)}
              >
                Filter
              </ToggleChip>
            )}

            <Button
              size="sm"
              disabled={forms.length === 0}
              onClick={() => setEditing({ entry: null, formId: formForNewRow })}
            >
              Add {noun}
            </Button>
          </>
        }
        /*
          ⚠️ Below the header rather than in a drawer: a filter somebody is composing and the rows it
          will narrow belong on one screen. A panel that covered the list would make every adjustment a
          guess.

          ⚠️ Only once a type is chosen. `entries` has no vocabulary of its own — what may be named
          comes from the FORM, so offering the builder over "all types" would offer an empty one, which
          reads as *this has no fields* rather than as *pick a type first*.
        */
        banner={
          selectedFormId && composing ? (
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
          ) : undefined
        }
        rail={{
          title: "Types",
          items: filterItems,
          activeKey: selectedFormId,
          onSelect: select,
          allLabel: allTypesLabel,
          allIcon: "☰",
          allCount: total,
          searchable: filterItems.length > 8,
          searchPlaceholder: "Filter the types…",
          footer: spaceSlug && doors.length > 0 ? <LevelDoors doors={doors} /> : undefined,
        }}
        /* ⚠️ **Pinned above the rows, and outside the scroller.** What the workspace holds is a fact
            about the workspace; what the list shows is a fact about what has been typed. A figure that
            scrolled away with the rows is one somebody has to scroll back to read.

            ⚠️ And the summary is only on Inventory. This component renders the parts catalogue too, and
            a catalogue row carries no quantity — a strip reading zero beside a full catalogue is not a
            summary, it is a defect somebody has to go and check. */
        toolbar={
          <>
            {section === "inventory" && (
              <StockSummaryStrip noun={noun} selectedFormId={selectedFormId} />
            )}

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

            {/* ⚠️ **Only once something is ticked**, and it takes the place of nothing. A bar that is
                always there is a strip of disabled buttons above every table in the product; a bar
                that appears is the answer to what somebody just did. */}
            {selected.size > 0 && (
              <div className="bg-accent/40 flex flex-wrap items-center gap-2 border-t px-2.5 py-1.5 text-xs">
                <span className="font-medium tabular-nums">{selected.size} selected</span>

                <LabelPrintButton
                  formId={activeForm?.id}
                  permission="entry:read"
                  ids={[...selected]}
                  subject={`${selected.size} ${noun}${selected.size === 1 ? "" : "s"}`}
                  label="Print labels"
                />

                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              </div>
            )}
          </>
        }
        pagination={
          entriesPage
            ? {
                page,
                totalPages: entriesPage.totalPages,
                totalElements: entriesPage.totalElements,
                size: entriesPage.size,
                onChange: setPage,
              }
            : undefined
        }
        footnote="Click a row for the panel · Enter opens the record · x ticks it"
        detail={{
          open: Boolean(peek.subject) && !peek.narrow,
          /* ⚠️ **A peek, not a second editor.** Everything here is read-only and the two controls are
              the two things a glance turns into: open the record, or change the count. Growing this
              into an editing surface would make it the third place a row can be edited from. */
          node: (
            <DetailsPanel
              state={peek}
              title={peek.subject ? titleOf(peek.subject, readFormConfigs(details[peek.subject.formId]?.config)) : ""}
              description="What the highlighted row holds"
            >
              {peek.subject && (
                <PeekBody
                  entry={peek.subject}
                  detail={details[peek.subject.formId] ?? null}
                  page={spaceSlug ? spaceSectionPath(spaceSlug, `entry/${peek.subject.formId}/${peek.subject.id}`) : null}
                  onEdit={() => setEditing({ entry: peek.subject, formId: peek.subject!.formId, asEditor: true })}
                  onAdjust={isPositions && peek.subject ? () => setAdjusting(peek.subject) : undefined}
                />
              )}
            </DetailsPanel>
          ),
        }}
      >
        <>
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
          ) : /* ⚠️ **The failure is this product's own `LoadFailure`, not `PageState`'s error kind.**
                 The library offers one for products that have nothing; Innoventa's tells four kinds
                 apart — offline, broken, refused, missing — and catches the paused query that stays
                 `pending` with no error attached and reads as a skeleton that never stops. Twelve
                 screens already use it, and a thirteenth answer to the same question would be worse
                 than any of them. */
          loadFailure ? (
            <LoadFailureNotice failure={loadFailure} onRetry={() => void refetchEntries()} />
          ) : isLoading ? (
            <PageState kind="loading" rows={10} />
          ) : visible.length === 0 ? (
            <PageState
              kind="empty"
              title={search ? "Nothing on this page matches" : `No ${noun}s yet`}
              text={
                search
                  ? "The search looks at the rows in hand — try another page, or narrow by type first."
                  : isAllTypes
                    ? `Record one against any type and it shows up here.`
                    : `Nothing has been recorded against ${activeLabel} yet.`
              }
              actions={
                (isPositions || !isAllTypes) && !search
                  ? [
                      {
                        label: `Add ${noun}`,
                        primary: true,
                        onClick: () => setEditing({ entry: null, formId: formForNewRow }),
                      },
                    ]
                  : []
              }
            />
          ) : (
            /* ⚠️ **No frame of its own.** The rows fill the content block that `ListScreen` owns; a
                bordered, rounded box here would be a frame inside a frame — the "облізлий блок" Ivan
                pointed at. The selection bar moved up into the pinned toolbar for the same reason. */
            <>
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
                  keyboard={keyboard}
                  activeForm={activeForm}
                  purposeCode={purposeCode}
                  pageOf={(entry) =>
                    spaceSlug ? spaceSectionPath(spaceSlug, `entry/${entry.formId}/${entry.id}`) : null
                  }
                  onPreview={(entry) => peek.show(entry)}
                  onEdit={(entry) => setEditing({ entry, formId: entry.formId, asEditor: true })}
                  onAdjust={setAdjusting}
                  selected={selected}
                  onToggleSelected={toggleSelected}
                />
              )}

            </>
          )}
        </>
      </ListScreen>

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

      {adjusting && (
        <AdjustQuantityDialog
          entryId={adjusting.id}
          label={titleOf(adjusting, readFormConfigs(details[adjusting.formId]?.config))}
          held={numberAt(adjusting, readFormConfigs(details[adjusting.formId]?.config).stockQuantityField)}
          onClose={() => setAdjusting(null)}
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
 * What the rail shows about the highlighted row.
 *
 * <p>⚠️ **The row's own fields, drawn by the same {@link FieldValue} the record page uses.** A rail with
 * its own idea of how a picture, a reference or a quantity renders is a second renderer that drifts —
 * and the first sign of the drift is a raw identifier where the record page shows a name.
 */
function PeekBody({
  entry,
  detail,
  page,
  onEdit,
  onAdjust,
}: {
  entry: FormEntry
  detail: FormDetail | null
  page: string | null
  onEdit: () => void
  onAdjust?: () => void
}) {
  const configs = readFormConfigs(detail?.config)
  const shown = (detail?.fields ?? []).filter(
    (field) => field.usageType !== "VIRTUAL" && field.name !== configs.imageField,
  )
  const picture = configs.imageField ? entry.fieldValues[configs.imageField] : undefined

  return (
    <div className="flex flex-col gap-3 p-3">
      {picture && (
        <img src={picture} alt="" className="max-h-40 w-full rounded-md border object-contain" />
      )}

      <dl className="flex flex-col gap-1.5">
        {shown.map((field) => (
          <div key={field.id} className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] items-baseline gap-2">
            <dt className="text-muted-foreground truncate text-[11px]">{field.label}</dt>
            <dd className="min-w-0 text-[12.5px]">
              {/* ⚠️ `optionsWithLabels`, never the field's own `options`. A field whose choices come from
                  a source carries no static options at all, so passing them straight through prints the
                  stored identifier — the defect INVT-321 fixed in two places. */}
              <FieldValue
                value={entry.fieldValues[field.name] ?? ""}
                elementType={field.elementType}
                unit={field.unit}
                options={optionsWithLabels(field, entry)}
              />
            </dd>
          </div>
        ))}
      </dl>

      {/* ⚠️ **Edit is here and is a BUTTON, not the panel becoming editable.** The rail answers "what is
          this"; changing it is a different act, and one surface that silently turns into the other is
          how somebody edits a row they meant to glance at. */}
      <div className="flex flex-wrap gap-2 border-t pt-3">
        <Button size="sm" onClick={onEdit}>
          <Pencil className="size-3.5" />
          Edit
        </Button>
        {page && (
          <Button asChild size="sm" variant="outline">
            <Link to={page}>Open the record</Link>
          </Button>
        )}
        {onAdjust && (
          <Button size="sm" variant="outline" onClick={onAdjust}>
            Adjust the count
          </Button>
        )}
      </div>
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
  keyboard,
  activeForm,
  purposeCode,
  pageOf,
  onPreview,
  onEdit,
  onAdjust,
  selected,
  onToggleSelected,
}: {
  entries: FormEntry[]
  forms: SpaceForm[]
  details: Record<string, FormDetail>
  /**
   * The keyboard layer, held by the page rather than here.
   *
   * ⚠️ The page owns it because the details rail and the bulk bar are the page's, and a keyboard state
   * living in the table would leave three components each holding their own idea of which row is active.
   */
  keyboard: ListKeyboard<FormEntry>
  activeForm: FormDetail | null
  /** Which of the two questions this listing is asking — see {@link StockColumns}. */
  purposeCode: string
  /**
   * Where a row lives on its own — for the control that says so, not for the row itself.
   *
   * ⚠️ Answers `null` only while the workspace slug is still resolving, and a row with nowhere to go
   * simply does not offer the control.
   */
  pageOf: (entry: FormEntry) => string | null
  /**
   * ⚠️ **A row click opens the RAIL beside the list, and neither edits nor navigates.** Somebody
   * scanning a list wants to look at a row and carry on scanning, so the list stays on screen and their
   * place in it is kept; the rail carries the acts that glance turns into — *Edit*, *Open the record*,
   * *Adjust the count* — as buttons that say which is which.
   *
   * ⚠️ **This used to open a centred dialog**, on the reasoning that a side panel "left half the window
   * showing a list nobody was reading". The rail is 376px beside a list rather than half of it, and it
   * closes on `Esc` — and the dialog's real cost was that the same question had two answers once the
   * keyboard's `Space` existed. Ivan chose the rail on 2026-08-31.
   */
  onPreview: (entry: FormEntry) => void
  /** ⚠️ Straight into the editor, because the control that opened it said Edit. */
  onEdit: (entry: FormEntry) => void
  /**
   * ⚠️ **The only way a quantity changes, so it is on the row as well as on the record.** Editing a
   * position opens a form whose quantity field is read-only; somebody counting a shelf works down a
   * list, and sending them into a record and back out again for every box is the difference between a
   * stocktake and an afternoon.
   */
  onAdjust: (entry: FormEntry) => void
  /** Which rows are ticked — for the bulk bar above the table. */
  selected: Set<string>
  onToggleSelected: (entryId: string) => void
}) {
  const isAllTypes = !activeForm
  const configs = readFormConfigs(activeForm?.config)

  /**
   * ⚠️ **Parts and positions get DIFFERENT extra columns, because the two ask different questions.**
   * A position is a box: what is in it and the minimum for that box are its own field values, already
   * drawn by the form's own columns. A part is an identity: what is held of it is the sum over every
   * box, and what is claimed of it is a project's promise about the part rather than about any one box
   * — neither of which is a field anywhere.
   *
   * ⚠️ **Which is why "reserved" and "available" are NOT on the positions table.** They were in the
   * prototype, where a reservation was against one box; a claim is against the part now, so printing it
   * on a row would be the same figure repeated beside every box the part sits in, each reading as if it
   * were about that box.
   */
  const isParts = purposeCode === "CATALOG"
  const partIds = useMemo(() => (isParts ? entries.map((entry) => entry.id) : []), [entries, isParts])

  const { data: totals } = usePartTotals(partIds)
  const { data: reserved } = usePartReservations(partIds)

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
            {/* ⚠️ Unlabelled and narrow. A heading over a column of checkboxes describes the control
                rather than the data, and this one is already explained by the bar it fills. */}
            <th className="w-px px-2.5 py-1.5" />
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

            {isParts && (
              <>
                <th className="px-2.5 py-1.5 text-right font-medium" title="Summed over every place it sits in">
                  Held
                </th>
                <th className="px-2.5 py-1.5 text-right font-medium" title="Claimed by projects in this workspace">
                  Claimed
                </th>
                <th className="px-2.5 py-1.5 text-right font-medium" title="Held minus claimed">
                  Free
                </th>
              </>
            )}

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
            //
            // ⚠️ **And it is about THIS PLACE.** The minimum lives on the position beside the quantity it
            // is compared with, so a drawer holding three reads low even when the next drawer along holds
            // two hundred. Whether the workspace has enough of the part in total is a different question
            // and is answered where the totals are.
            const quantity = numberAt(entry, rowConfigs.stockQuantityField)
            const threshold = numberAt(entry, rowConfigs.stockThresholdField)
            const isLow = quantity !== null && threshold !== null && quantity < threshold

            const page = pageOf(entry)

            return (
              <tr
                key={entry.id}
                {...keyboard.rowProperties(entry)}
                /* ⚠️ **A click opens the rail, not a dialog** — one surface for "what is this row".
                   The keyboard layer's own click makes the row active; the peek follows, so clicking
                   and pressing `Space` land in the same place. The centred dialog is now reached only
                   by *Edit*, which is a different act and says so. */
                onClick={(event) => {
                  keyboard.rowProperties(entry).onClick(event)
                  if (!(event.target as HTMLElement).closest("a, button, input, select, textarea")) {
                    onPreview(entry)
                  }
                }}
                className={cn(
                  "group cursor-pointer border-b transition-colors last:border-b-0 hover:bg-accent",
                  // ⚠️ A ring rather than a fill. The active row can be a low-stock row, and a
                  // background that replaced the red one would hide the fact the table exists to show.
                  "focus-visible:outline-none data-[active]:ring-ring data-[active]:ring-2 data-[active]:ring-inset",
                  isLow && "border-l-2 border-l-destructive bg-destructive/5",
                )}
              >
                {/* ⚠️ `stopPropagation`, or ticking a row also opens it. */}
                <td className="px-2.5 py-1.5" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="size-3.5 cursor-pointer align-middle accent-primary"
                    checked={selected.has(entry.id)}
                    aria-label={`Select ${titleOf(entry, rowConfigs)}`}
                    onChange={() => onToggleSelected(entry.id)}
                  />
                </td>

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

                {columns.map((field) => {
                  const held = entry.fieldValues[field.name] ?? ""
                  const options = optionsWithLabels(field, entry)
                  const drawn = (
                    <FieldValue
                      value={held}
                      elementType={field.elementType}
                      unit={field.unit}
                      options={options}
                      children={childSegments(field, entry)}
                    />
                  )
                  /* ⚠️ **Only the fields the TYPE nominates, and only when there is a value.** A cell
                     offering to narrow to nothing is a control that produces an empty list, and a type
                     that nominates no field offers no links at all — which is the ordinary case. */
                  const filterable =
                    activeForm !== null
                    && configs.filterableFields.includes(field.name)
                    && held.trim() !== ""

                  return (
                    <td key={field.id} className="max-w-64 truncate px-2.5 py-1.5">
                      {filterable ? (
                        <FilterableValue
                          subject={entriesOf(activeForm.id)}
                          field={field.name}
                          value={held}
                          label={{
                            field: field.label || field.name,
                            value:
                              options.find((option) => option.optionValue === held)?.optionLabel
                              ?? held,
                          }}
                        >
                          {drawn}
                        </FilterableValue>
                      ) : (
                        drawn
                      )}
                    </td>
                  )
                })}

                {isAllTypes && (
                  <td className="max-w-80 truncate px-2.5 py-1.5">{titleOf(entry, rowConfigs)}</td>
                )}

                {isParts && <PartStockCells entry={entry} totals={totals} reserved={reserved} />}

                <td className="px-2.5 py-1.5 text-xs text-muted-foreground">{relativeTime(entry.updatedAt)}</td>

                {/* ⚠️ **`stopPropagation`, or every control here also opens the page behind it.** The
                    row is the link; these sit on top of it and mean something else. */}
                <td className="px-2.5 py-1.5" onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-center justify-end gap-0.5">
                    {/* ⚠️ Before Edit, because on a position it is the thing Edit cannot do. */}
                    {rowConfigs.stockQuantityField && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Change the quantity"
                        aria-label="Change the quantity"
                        onClick={() => onAdjust(entry)}
                      >
                        <ArrowDownUp className="size-3.5" />
                      </Button>
                    )}

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

/**
 * What the row is called.
 *
 * ⚠️ **A title can be a REFERENCE, and a reference stored is an identifier.** A position is named by the
 * part it is a quantity of, so the value in that field is a catalogue entry's id — printed raw it reads
 * `OaFGD0d1Ed1zzaNE` where `SS34` belongs. The name comes back on the row as `optionLabels`, resolved
 * server-side, because the browser has no way to work it out.
 *
 * ⚠️ Falls back to the first value the row happens to carry — a row with no name is still a row.
 */
function titleOf(entry: FormEntry, configs: FormConfigs): string {
  const stored = configs.primaryField ? entry.fieldValues[configs.primaryField] : undefined
  const resolved =
    configs.primaryField && stored ? entry.optionLabels?.[configs.primaryField]?.[stored] : undefined

  return resolved || stored || Object.values(entry.fieldValues)[0] || "—"
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

/**
 * What a part is held of, what is claimed of it, and what that leaves.
 *
 * ⚠️ **Three numbers about the PART, on the part's row** — none of them a field on any record. What is
 * held is the sum over every box; what is claimed is what projects have promised themselves; free is
 * the difference, and it is the only one of the three somebody can act on.
 *
 * ⚠️ **A dash, never a zero, while the answer is still coming or was refused.** A part nothing is held
 * of and a part nobody has counted yet both look like nothing, and printing `0` for the second is the
 * screen making a claim it has not been told. The claimed column is refusable on its own — it is gated
 * on being able to see projects — and simply reads as a dash for a reader without that.
 */
function PartStockCells({
  entry,
  totals,
  reserved,
}: {
  entry: FormEntry
  totals: Record<string, PartTotal> | undefined
  reserved: Record<string, number> | undefined
}) {
  const held = totals?.[entry.id]?.totalQuantity ?? null
  const places = totals?.[entry.id]?.positionCount ?? 0
  const claimed = reserved?.[entry.id] ?? null
  const free = held === null ? null : Math.max(0, held - (claimed ?? 0))

  return (
    <>
      <td className="px-2.5 py-1.5 text-right font-mono tabular-nums">
        {held === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span title={places === 1 ? "in one place" : `across ${places} places`}>
            {held}
            {places > 1 && <span className="ml-1 text-[10px] text-muted-foreground">×{places}</span>}
          </span>
        )}
      </td>

      <td className="px-2.5 py-1.5 text-right font-mono tabular-nums">
        {claimed ? (
          <span className="text-amber-600 dark:text-amber-400">{claimed}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      <td className="px-2.5 py-1.5 text-right font-mono tabular-nums">
        {free === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className={cn(free === 0 && "text-muted-foreground")}>{free}</span>
        )}
      </td>
    </>
  )
}
