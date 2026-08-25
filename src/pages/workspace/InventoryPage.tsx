import { useEffect, useMemo, useState } from "react"
import { useQueries } from "@tanstack/react-query"
import { toast } from "sonner"
import { Badge, Button, type FilterItem, FilterPanel, Input, Skeleton, cn } from "@jmouse/ui"
import { LevelDoor, LevelDoors } from "@/components/LevelDoor"
import { PageHeader } from "@/components/PageHeader"
import { ViewBar } from "@/components/ViewBar"
import { ToggleChip } from "@/components/ToggleChip"
import { QueryPanel, type AppliedQuery } from "@jmouse/query"
import { entriesOf, ENTRIES } from "@/components/query/subjects"
import { presetsFor } from "@/components/query/presets"
import { QUERY_LABELS } from "@/components/query/labels"
import { Pagination } from "@/components/Pagination"
import { EntryDetailDrawer } from "@/components/form/EntryDetailDrawer"
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
  title = "Inventory",
  noun = "component",
}: {
  purposeCode?: string
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

  const [selectedFormId, setSelectedFormId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [jmq, setJmq] = useState<AppliedQuery>({})
  const [composing, setComposing] = useState(false)
  const [editing, setEditing] = useState<{ entry: FormEntry | null; formId: string } | null>(null)
  const [activeViewId, setActiveViewId] = useState<string | null>(null)

  const { data: forms = [], isLoading: formsLoading } = useWorkspaceForms(purposeCode)

  // A workspace switch has to forget which type was open — the id belongs to the workspace we left.
  useEffect(() => {
    setSelectedFormId(null)
    setPage(0)
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
    setSelectedFormId(formId)
    setPage(0)
    // Narrowing by hand un-claims the view: the filter is no longer what it stored.
    setActiveViewId(null)
  }

  useViewFromAddress<{ formId?: string | null; search?: string }>(section, (applied, viewId) => {
    setSelectedFormId(applied.formId ?? null)
    setSearch(applied.search ?? "")
    setPage(0)
    setActiveViewId(viewId)
  })

  const activeLabel = activeForm ? (activeForm.codename ?? activeForm.name) : "All types"
  const editedForm = editing ? (details[editing.formId] ?? null) : null

  return (
    <>
      <PageHeader
        title={title}
        description={`${activeLabel} — ${entriesPage?.totalElements ?? 0} recorded`}
        actions={
          <>
            <Input
              className="h-8 w-64 text-sm"
              value={search}
              placeholder={`Search every ${noun}…`}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(0)
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
          presets={presetsFor(ENTRIES)}
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
          allLabel="All types"
          allIcon="☰"
          allCount={total}
          searchable={filterItems.length > 8}
          searchPlaceholder="Filter the types…"
          footer={
            spaceSlug && doors.length > 0 ? <LevelDoors doors={doors} /> : undefined
          }
        />

        <div className="flex min-w-0 flex-col gap-3">
          <ViewBar
            section={section}
            filter={{ formId: selectedFormId, search }}
            isFiltered={Boolean(selectedFormId || search.trim())}
            activeViewId={activeViewId}
            onApply={(applied, viewId) => {
              setSelectedFormId(applied.formId ?? null)
              setSearch(applied.search ?? "")
              setPage(0)
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
              <EntriesTable
                entries={visible}
                forms={forms}
                details={details}
                activeForm={activeForm}
                onOpen={(entry) => setEditing({ entry, formId: entry.formId })}
              />

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
          isNew={!editing.entry}
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
  onOpen,
}: {
  entries: FormEntry[]
  forms: SpaceForm[]
  details: Record<string, FormDetail>
  activeForm: FormDetail | null
  onOpen: (entry: FormEntry) => void
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

            return (
              <tr
                key={entry.id}
                onClick={() => onOpen(entry)}
                className={cn(
                  "cursor-pointer border-b transition-colors last:border-b-0 hover:bg-accent",
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
