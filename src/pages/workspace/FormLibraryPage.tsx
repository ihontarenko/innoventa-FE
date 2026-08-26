import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  type FilterItem,
  FilterPanel,
  Input,
  Skeleton,
} from "@jmouse/ui"
import { MoreHorizontal } from "lucide-react"
import { CardGroup, PageCard } from "@/components/PageCard"
import { LevelDoors } from "@/components/LevelDoor"
import { PageHeader } from "@/components/PageHeader"
import { CardDensityToggle } from "@/components/CardDensityToggle"
import { SegmentedControl } from "@/components/SegmentedControl"
import { CreateFormDialog } from "@/components/form/CreateFormDialog"
import { EntryFormDialog } from "@/components/form/EntryFormDialog"
import { FormManagementDialog } from "@/components/form/FormManagementDialog"
import { FormPreviewDialog } from "@/components/form/FormPreviewDialog"
import {
  useAllForms,
  useCreateEntry,
  useDeleteForm,
  useEntryCounts,
  usePurposes,
  useWorkspaceForms,
} from "@/hooks/useWorkspaceForms"
import { useEntityIdsByTag, useTagStats } from "@/hooks/useFieldCatalogue"
import { spaceSectionPath } from "@/lib/navigationContext"
import { groupHues } from "@/lib/groupHues"
import { useSpaceNavigation } from "@/hooks/useSpaces"
import { useSpaceStore } from "@/stores/spaceStore"
import type { FormAudience, FormSummary, SpacePresentation } from "@/types"

/** Which set of forms the library is looking at. */
type LibraryScope = "workspace" | "everywhere"

const TAG_PREFIX = "tag:"

const UNCATEGORISED = "uncategorised"

/*
 * ⚠️ **There used to be a `SUBJECT_AREA_VIEWS` map here, and its absence is deliberate.**
 *
 * It read `INVENTORY → { section: "component-types", label: "Seen as a component type" }` — this screen
 * naming an electronics screen, an electronics route and an electronics noun. Its own comment called
 * itself "the only trace of the subject area", which was a confession rather than a defence: the form
 * library is the platform's base, and the base never knows what a component is.
 *
 * The door between the two levels was never the problem — what was wrong is that the LOW level held the
 * map. The subject area declares it now (`SubjectAreaDefinition.presentations()`), the workspace's
 * navigation carries it, and this screen renders whatever it is handed. Do not put a purpose code back
 * here: the next area to present a purpose differently must cost a line in that area, not an `if` here.
 */

/**
 * What each audience is called on screen, and what choosing it means.
 *
 * ⚠️ **`MEMBERS` carries no chip.** It is what every form is unless somebody decided otherwise, and a
 * badge on the ordinary case is noise on every card in the grid.
 */
const AUDIENCES: Record<FormAudience, { glyph: string; label: string; what: string }> = {
  MEMBERS: { glyph: "👥", label: "Workspace", what: "You, and whoever is in the workspaces this form is placed in." },
  EVERYONE: { glyph: "⭐", label: "Everyone", what: "Everybody in the installation sees it and may attach it." },
  STAFF: { glyph: "🔒", label: "Internal", what: "Only holders of form:read:internal. A share link still works." },
}

/**
 * Every form as a *schema* — what exists, what it is for, and how to get into its builder.
 *
 * ⚠️ **Two scopes, because a form is installation-wide and a workspace only *shows* a subset.** The
 * library has to answer both: "what does this workspace stock" is the ordinary question, and "what else
 * could it stock" is the one somebody asks the moment they want to attach something. A single filtered
 * list would answer the first and make the second unaskable.
 *
 * ⚠️ **Purpose facets with a count of zero are dropped.** A facet that opens onto nothing is a dead end
 * rather than a filter — and it is how the internal Bug Report purpose came to sit in the sidebar of
 * readers who have no bug reports to see.
 *
 * ⚠️ **The card's *door* is the schema, and `Open` is the form itself.** This screen is about what a
 * form *is*, so the level down is its builder — but a form nobody can answer from the one screen that
 * lists every form is a schema with no way in, and for a purpose with no subject-area view of its own
 * there was no other way in at all. `Open` fills it in and records an answer, in a modal (Ivan,
 * 2026-08-21); it does not replace the entries screens, which are about the rows rather than the form.
 */
export function FormLibraryPage() {
  const navigate = useNavigate()
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId)

  // Where each purpose is seen as a domain object — declared by the subject area, served with the menu,
  // and rendered here without this screen knowing what any of it means.
  const { data: navigation } = useSpaceNavigation(activeSpaceId ?? undefined)
  const presentations = navigation?.presentations ?? {}

  const [scope, setScope] = useState<LibraryScope>("workspace")
  const [search, setSearch] = useState("")
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [managedFormId, setManagedFormId] = useState<string | null>(null)
  const [filledFormId, setFilledFormId] = useState<string | null>(null)
  const [previewFormId, setPreviewFormId] = useState<string | null>(null)

  // A workspace scope with no workspace to stand in would show nothing and explain nothing.
  const effectiveScope: LibraryScope = activeSpaceId ? scope : "everywhere"

  const { data: workspaceForms = [], isLoading: workspaceLoading } = useWorkspaceForms()
  const { data: everyForm, isLoading: everywhereLoading } = useAllForms(effectiveScope === "everywhere")

  const { data: purposes = [] } = usePurposes()
  const { data: tagStats = [] } = useTagStats("FORM")

  const scoped: FormSummary[] = effectiveScope === "workspace" ? workspaceForms : (everyForm?.content ?? [])
  const isLoading = effectiveScope === "workspace" ? workspaceLoading : everywhereLoading

  const activeTagId = activeKey?.startsWith(TAG_PREFIX) ? activeKey.slice(TAG_PREFIX.length) : undefined
  const activePurposeCode = activeKey && !activeTagId ? activeKey : undefined
  const { data: taggedIds } = useEntityIdsByTag(activeTagId)

  const deleteForm = useDeleteForm()
  const createEntry = useCreateEntry()


  const filterItems: FilterItem[] = [
    ...purposes
      .map((purpose) => ({
        key: purpose.code,
        icon: purpose.icon ?? "📄",
        label: purpose.label,
        count: scoped.filter((form) => form.purpose?.code === purpose.code).length,
      }))
      .filter((facet) => facet.count > 0),
    ...tagStats.map((tag, index) => ({
      key: `${TAG_PREFIX}${tag.id}`,
      icon: tag.icon ?? "🏷",
      label: tag.name,
      count: tag.count,
      dividerLabel: index === 0 ? "Tags" : undefined,
    })),
  ]

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()

    return scoped
      .filter((form) => !activePurposeCode || form.purpose?.code === activePurposeCode)
      .filter((form) => !activeTagId || taggedIds?.includes(form.id))
      .filter(
        (form) =>
          needle === "" ||
          form.name.toLowerCase().includes(needle) ||
          (form.codename ?? "").toLowerCase().includes(needle) ||
          (form.description ?? "").toLowerCase().includes(needle),
      )
  }, [scoped, activePurposeCode, activeTagId, taggedIds, search])

  /**
   * ⚠️ **How much has been answered, as text rather than as a fifth button.** "12 submissions" beside
   * "9 fields" is the fact somebody wants; a control for it would be one more thing crowding a footer
   * that is already two rows deep. The verb lives in the card's menu, the number lives on the card.
   *
   * One batched request for every visible form — never one per card.
   */
  const { data: submissionCounts = {} } = useEntryCounts(visible.map((form) => form.id))

  // Grouped by category, uncategorised last — the same shape the component-type screen uses, because
  // it is the same object seen from a different side.
  const groups = useMemo(() => {
    const byCategory = new Map<string, { title: string; icon: string | null; forms: FormSummary[] }>()

    for (const form of visible) {
      const key = form.category?.id ?? UNCATEGORISED
      const bucket = byCategory.get(key) ?? {
        title: form.category?.name ?? "Uncategorised",
        icon: form.category?.icon ?? null,
        forms: [],
      }

      bucket.forms.push(form)
      byCategory.set(key, bucket)
    }

    return [...byCategory.entries()]
      .sort(([leftKey, left], [rightKey, right]) => {
        if (leftKey === UNCATEGORISED) {
          return 1
        }

        if (rightKey === UNCATEGORISED) {
          return -1
        }

        return left.title.localeCompare(right.title)
      })
      .map(([key, group]) => ({ key, ...group }))
  }, [visible])

  // Handed out in the order the groups are drawn, so the colours run down the screen rather than
  // jumping about — see `groupHues` for why position beats hashing.
  const hueOfGroup = useMemo(() => groupHues(groups.map((group) => group.key)), [groups])

  const managedForm = scoped.find((form) => form.id === managedFormId)
  const filledForm = scoped.find((form) => form.id === filledFormId)

  return (
    <>
      <PageHeader
        title="Form library"
        description={`${scoped.length} form${scoped.length === 1 ? "" : "s"} — a schema, and what it is for`}
        actions={
          <>
            {/* ⚠️ **A segment control, and at the header's own size** (Ivan, 2026-08-21). It was two
                chips: a pair of 11-pixel pills beside a 32-pixel search box and a 32-pixel button, which
                read as a caption rather than as the control it is. Two mutually exclusive choices are a
                segment control by definition — modelling them as two independent toggles was the reason
                the sizes never lined up. */}
            <SegmentedControl
              ariaLabel="Which forms to show"
              value={effectiveScope}
              onChange={setScope}
              segments={[
                { value: "workspace", label: "This workspace", disabled: !activeSpaceId },
                { value: "everywhere", label: "Everywhere" },
              ]}
            />

            <Input
              size="sm"
              className="w-56"
              value={search}
              placeholder="Search forms…"
              onChange={(event) => setSearch(event.target.value)}
            />
            <CardDensityToggle />
            <Button size="sm" onClick={() => setCreating(true)}>
              New form
            </Button>
          </>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <FilterPanel
          title="Filter by"
          items={filterItems}
          activeKey={activeKey}
          onSelect={setActiveKey}
          allLabel={effectiveScope === "workspace" ? "This workspace" : "Everywhere"}
          allIcon="☰"
          allCount={scoped.length}
        />

        <div className="flex min-w-0 flex-col gap-5">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
              <span aria-hidden="true" className="text-2xl">
                📋
              </span>
              <span className="text-sm font-medium">{scoped.length === 0 ? "No forms here" : "Nothing matches"}</span>
              <span className="max-w-md text-xs text-muted-foreground">
                {scoped.length === 0 && effectiveScope === "workspace"
                  ? "Nothing is attached to this workspace yet. Create one here, or look everywhere to see what you could attach."
                  : "A form is a schema — a set of fields, and a purpose that says what answering it means."}
              </span>
              {scoped.length === 0 && (
                <Button size="sm" className="mt-2" onClick={() => setCreating(true)}>
                  New form
                </Button>
              )}
            </div>
          ) : (
            groups.map((group) => (
              <CardGroup
                key={group.key}
                title={group.title}
                icon={group.icon}
                count={group.forms.length}
                hue={hueOfGroup.get(group.key)}
              >
                {group.forms.map((form) => (
                  <FormCard
                    key={form.id}
                    form={form}
                    onSchema={() => navigate(spaceSectionPath(spaceSlug ?? "", `forms/${form.id}`))}
                    onOpenForm={() => setFilledFormId(form.id)}
                    onPreview={() => setPreviewFormId(form.id)}
                    onSubmissions={() =>
                      navigate(`${spaceSectionPath(spaceSlug ?? "", "results")}?form=${form.id}`)
                    }
                    onManage={() => setManagedFormId(form.id)}
                    spaceSlug={spaceSlug}
                    doors={form.purpose ? (presentations[form.purpose.code] ?? []) : []}
                    submissions={submissionCounts[form.id]}
                    onDelete={() =>
                      deleteForm.mutate(form.id, {
                        onSuccess: () => toast.success(`${form.name} deleted.`),
                        onError: (error) => {
                          const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail

                          toast.error(detail ?? "Could not delete this form.")
                        },
                      })
                    }
                  />
                ))}
              </CardGroup>
            ))
          )}
        </div>
      </div>

      {creating && <CreateFormDialog onClose={() => setCreating(false)} />}

      {filledForm && (
        <EntryFormDialog
          formId={filledForm.id}
          formName={filledForm.name}
          submitLabel="Submit"
          isSubmitting={createEntry.isPending}
          onSubmit={async (values) => {
            await createEntry.mutateAsync({ formId: filledForm.id, fieldValues: values })
            toast.success(`Recorded against ${filledForm.name}.`)
            setFilledFormId(null)
          }}
          onClose={() => setFilledFormId(null)}
        />
      )}

      {managedForm && <FormManagementDialog form={managedForm} onClose={() => setManagedFormId(null)} />}

      {previewFormId && <FormPreviewDialog formId={previewFormId} onClose={() => setPreviewFormId(null)} />}
    </>
  )
}

function FormCard({
  form,
  spaceSlug,
  doors,
  submissions,
  onSchema,
  onOpenForm,
  onPreview,
  onSubmissions,
  onManage,
  onDelete,
}: {
  form: FormSummary
  spaceSlug: string | null
  /** Every place this form is seen as a domain object. Served, never compiled; empty is ordinary. */
  doors: SpacePresentation[]
  onSchema: () => void
  /** Opens the form itself, to be filled in and submitted. */
  onOpenForm: () => void
  /** The form as somebody filling it in will meet it — in a window, recording nothing. */
  onPreview: () => void
  /** Its own rows — the question the card could not answer at all before. */
  onSubmissions: () => void
  /** How many rows it holds here. Undefined while the batch is still in flight. */
  submissions?: number
  onManage: () => void
  onDelete: () => void
}) {
  const audience = AUDIENCES[form.audience]
  const openDoors = spaceSlug
    ? doors.map((door) => ({ label: door.label, to: spaceSectionPath(spaceSlug, door.section) }))
    : []

  /**
   * ⚠️ **The submission count is a CHIP, not part of the measure beside the name.** Putting it there was
   * tried and it truncated every title: the measure is `shrink-0`, so a longer one takes its width from
   * the name — and a card whose name reads "Bug …" has lost the only thing somebody scans for. Chips
   * wrap onto their own line, which is what a fact of unpredictable length needs.
   *
   * ⚠️ **Zero carries no chip.** Most forms in a fresh workspace have no submissions, and a chip on
   * every card saying so is a row of noise; the card's menu still leads to the empty list.
   */
  const chips = [
    form.purpose ? { key: "purpose", glyph: form.purpose.icon, label: form.purpose.label } : null,
    submissions === undefined || submissions === 0
      ? null
      : { key: "submissions", glyph: "◔", label: `${submissions} submitted` },
    form.shareToken ? { key: "shared", glyph: "🔗", label: "Shared" } : null,
    form.audience === "MEMBERS" ? null : { key: "audience", glyph: audience.glyph, label: audience.label },
  ].filter(Boolean) as Array<{ key: string; glyph: string | null; label: string }>

  return (
    <PageCard
      icon={form.icon ?? form.name[0]?.toUpperCase() ?? "?"}
      panelCount={form.fieldCount > 0 ? `${form.fieldCount} fields` : "no fields"}
      name={form.name}
      isDraft={form.status !== "ACTIVE"}
      // ⚠️ Only a DRAFT is badged — “Published” is the state nearly every form is in, and a badge on
      // the default state is a badge that says nothing.
      badge={form.status === "ACTIVE" ? undefined : <Badge variant="outline">Draft</Badge>}
      description={form.description}
      chips={
        chips.length > 0
          ? chips.map((chip) => (
              <Badge key={chip.key} variant="outline">
                {chip.glyph ? `${chip.glyph} ${chip.label}` : chip.label}
              </Badge>
            ))
          : undefined
      }
      onOpen={onSchema}
      actions={
        <>
          {/* ⚠️ **One visible verb, the rest in a menu** (Ivan, 2026-08-21: «кнопкам вже тісно»). Three
              buttons plus a door plus a delete control wrapped onto two rows in a three-column grid, and
              a card whose chrome is taller than its content has stopped being a card. The library is
              about SCHEMAS, so the schema is the one that stays out. */}
          <Button variant="outline" size="sm" onClick={onSchema}>
            Schema
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="More" title="More">
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* ⚠️ **Every form opens, whatever it is for.** A schema exists to be answered, and a
                  library that could only describe its forms put the one thing they are for behind
                  another screen — or, for a purpose with no second face, behind no screen at all.
                  Offered on a draft too: trying a schema out is exactly what a draft is for. */}
              {/* ⚠️ Preview and *Fill it in* are not the same offer, and both belong here: one is the
                  form as somebody will meet it, thrown away when the window closes; the other records
                  a row. A library that only had the second made trying a schema out cost real data. */}
              <DropdownMenuItem onSelect={onPreview}>Preview</DropdownMenuItem>
              <DropdownMenuItem onSelect={onOpenForm}>Fill it in</DropdownMenuItem>
              <DropdownMenuItem onSelect={onSubmissions}>See its submissions</DropdownMenuItem>
              <DropdownMenuItem onSelect={onManage}>Manage</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
      door={openDoors.length > 0 ? <LevelDoors doors={openDoors} /> : undefined}
      onDelete={onDelete}
      confirmMessage={`Delete "${form.name}"?`}
    />
  )
}

