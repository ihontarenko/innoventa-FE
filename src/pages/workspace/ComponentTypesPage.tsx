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
import { LevelDoor } from "@/components/LevelDoor"
import { PageHeader } from "@/components/PageHeader"
import { ViewBar } from "@/components/ViewBar"
import { CardDensityToggle } from "@/components/CardDensityToggle"
import { EntryFormDialog } from "@/components/form/EntryFormDialog"
import { CreateFormDialog } from "@/components/form/CreateFormDialog"
import { FormManagementDialog } from "@/components/form/FormManagementDialog"
import { FormPreviewDialog } from "@/components/form/FormPreviewDialog"
import { useCreateEntry, useDeleteForm, useWorkspaceForms } from "@/hooks/useWorkspaceForms"
import { spaceSectionPath } from "@/lib/navigationContext"
import { groupHues } from "@/lib/groupHues"
import { useViewFromAddress } from "@/hooks/useViewFromAddress"
import { useSpaceStore } from "@/stores/spaceStore"
import type { SpaceForm } from "@/api/spaces"

/** The purpose that makes a form a component type. ⚠️ Branch on the code, never on a form's id. */
const INVENTORY = "INVENTORY"

const UNCATEGORISED = "uncategorised"

/**
 * The component types this workspace counts.
 *
 * ⚠️ **A "component type" is a form with the `INVENTORY` purpose** — the same object the form library
 * lists, seen from the side that matters here. Two screens over one thing, deliberately: the library is
 * about *schemas*, this is about *what this workspace stocks*, and somebody arriving at one is not
 * looking for the other.
 *
 * ⚠️ **Cards or rows, and the account chooses** (`CardDensityToggle`): forty types is a list to scan
 * when you know the one you want and a grid to browse when you do not. Both shapes carry the same
 * facts — the glyph, the name, what it stocks, and the two things you can do with it.
 */
export function ComponentTypesPage() {
  const navigate = useNavigate()
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)

  const { data: types = [], isLoading } = useWorkspaceForms(INVENTORY)

  const [search, setSearch] = useState("")
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [openFormId, setOpenFormId] = useState<string | null>(null)
  const [managedTypeId, setManagedTypeId] = useState<string | null>(null)
  const [previewTypeId, setPreviewTypeId] = useState<string | null>(null)
  const [activeViewId, setActiveViewId] = useState<string | null>(null)

  useViewFromAddress<{ categoryId?: string | null; search?: string }>("component-types", (applied, viewId) => {
    setActiveCategoryId(applied.categoryId ?? null)
    setSearch(applied.search ?? "")
    setActiveViewId(viewId)
  })

  const deleteForm = useDeleteForm()
  const createEntry = useCreateEntry()

  const categories = useMemo(() => {
    const byId = new Map(types.filter((form) => form.category).map((form) => [form.category!.id, form.category!]))

    return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name))
  }, [types])

  const uncategorisedCount = types.filter((form) => !form.category).length
  const managedType = types.find((form) => form.id === managedTypeId) ?? null

  const filterItems: FilterItem[] = [
    ...categories.map((category) => ({
      key: category.id,
      icon: category.icon ?? "◫",
      label: category.name,
      count: types.filter((form) => form.category?.id === category.id).length,
    })),
    ...(uncategorisedCount > 0
      ? [{ key: UNCATEGORISED, icon: "◫", label: "Uncategorised", count: uncategorisedCount }]
      : []),
  ]

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()

    return types
      .filter((form) =>
        activeCategoryId === null
          ? true
          : activeCategoryId === UNCATEGORISED
            ? !form.category
            : form.category?.id === activeCategoryId,
      )
      .filter((form) => needle === "" || form.name.toLowerCase().includes(needle))
  }, [types, activeCategoryId, search])

  const groups = useMemo(() => groupByCategory(visible), [visible])

  // Handed out in the order the groups are drawn, so the colours run down the screen rather than
  // jumping about — see `groupHues` for why position beats hashing.
  const hueOfGroup = useMemo(() => groupHues(groups.map((group) => group.id)), [groups])

  return (
    <>
      <PageHeader
        title="Component types"
        description={`${types.length} in this workspace`}
        actions={
          <>
            <Input
              className="h-8 w-56 text-sm"
              value={search}
              placeholder="Search types…"
              onChange={(event) => setSearch(event.target.value)}
            />
            <CardDensityToggle />
            <Button size="sm" onClick={() => setCreating(true)}>
              New type
            </Button>
          </>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <FilterPanel
          title="Category"
          items={filterItems}
          activeKey={activeCategoryId}
          onSelect={(key) => {
            setActiveCategoryId(key)
            // Narrowing by hand un-claims the view.
            setActiveViewId(null)
          }}
          allLabel="All types"
          allCount={types.length}
          searchable={filterItems.length > 8}
        />

        <div className="flex min-w-0 flex-col gap-5">
          <ViewBar
            section="component-types"
            filter={{ categoryId: activeCategoryId, search }}
            isFiltered={Boolean(activeCategoryId || search.trim())}
            activeViewId={activeViewId}
            onApply={(applied, viewId) => {
              setActiveCategoryId(applied.categoryId ?? null)
              setSearch(applied.search ?? "")
              setActiveViewId(viewId)
            }}
          />

          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
              <span aria-hidden="true" className="text-2xl">
                ◫
              </span>
              <span className="text-sm font-medium">
                {types.length === 0 ? "No component types yet" : "Nothing matches"}
              </span>
              <span className="max-w-md text-xs text-muted-foreground">
                {types.length === 0
                  ? "A component type is a form this workspace stocks things against — its fields are what a row of stock records."
                  : "No type in this workspace answers to that."}
              </span>
            </div>
          ) : (
            groups.map((group) => (
              <CardGroup
                key={group.id}
                title={group.name}
                icon={group.icon}
                count={group.forms.length}
                hue={hueOfGroup.get(group.id)}
              >
                {group.forms.map((form) => (
                  <TypeCard
                    key={form.id}
                    form={form}
                    onOpenSchema={() => spaceSlug && navigate(spaceSectionPath(spaceSlug, `forms/${form.id}`))}
                    onAddEntry={() => setOpenFormId(form.id)}
                    onManage={() => setManagedTypeId(form.id)}
                    onPreview={() => setPreviewTypeId(form.id)}
                    onDelete={() =>
                      deleteForm.mutate(form.id, {
                        onSuccess: () => toast.success(`${form.name} deleted.`),
                        onError: () => toast.error("Could not delete this type."),
                      })
                    }
                  />
                ))}
              </CardGroup>
            ))
          )}
        </div>
      </div>

      {openFormId && (
        <EntryFormDialog
          formId={openFormId}
          formName={types.find((form) => form.id === openFormId)?.name}
          isSubmitting={createEntry.isPending}
          onSubmit={async (values) => {
            await createEntry.mutateAsync({ formId: openFormId, fieldValues: values })
            toast.success("Recorded.")
            setOpenFormId(null)
          }}
          onClose={() => setOpenFormId(null)}
        />
      )}

      {creating && <CreateFormDialog title="New component type" purposeCode={INVENTORY} onClose={() => setCreating(false)} />}

      {/* ⚠️ **The same management dialog the form library opens**, and that is the point: a component
          type IS a form with the `INVENTORY` purpose, so where it is filed, whether it is shared and how
          its entries are summarised are one set of answers. A second editor here would be a second place
          for them to be wrong. */}
      {/* ⚠️ `domain`, not `base`: every form on this screen is an `INVENTORY` one inside this workspace,
          so the subject area's own configuration — what counts as stock, what a price is read from —
          belongs here and nowhere in the library (Ivan, 2026-08-25). */}
      {managedType && (
        <FormManagementDialog form={managedType} depth="domain" onClose={() => setManagedTypeId(null)} />
      )}

      {previewTypeId && <FormPreviewDialog formId={previewTypeId} onClose={() => setPreviewTypeId(null)} />}
    </>
  )
}

function TypeCard({
  form,
  onOpenSchema,
  onAddEntry,
  onManage,
  onPreview,
  onDelete,
}: {
  form: SpaceForm
  onOpenSchema: () => void
  onAddEntry: () => void
  /** Where it is filed, who may reach it, how its entries are summarised — the form library's dialog. */
  onManage: () => void
  /** The type's own form, as somebody recording a part will meet it. Records nothing. */
  onPreview: () => void
  onDelete: () => void
}) {
  const published = form.status === "ACTIVE"

  return (
    <PageCard
      icon={form.icon ?? form.name.trim()[0]?.toUpperCase() ?? "?"}
      // ⚠️ **No field count here, and it is the level rule again** (Ivan, 2026-08-21). How many fields a
      // schema has is a fact about the schema, and this screen is about what the workshop stocks —
      // nobody choosing a component type to add a relay to is scanning for "22". The form library, which
      // *is* about schemas, still carries it, and the door below leads there.
      name={form.name}
      isDraft={!published}
      // ⚠️ Only a DRAFT is badged. “Published” is the state every type is in, so a grid of them was
      // twenty orange marks all saying the same thing — and all fighting the theme’s own accent.
      badge={published ? undefined : <Badge variant="outline">Draft</Badge>}
      description={form.description}
      // ⚠️ No category chip: the card is sitting under that category’s own heading, and the edge down
      // its left is that category’s colour. A third copy of the same word is not a third signal.
      actions={
        // ⚠️ Only a published type takes a row. A draft's schema is still being written, and a row
        // recorded against it would be answers to questions that changed afterwards.
        <>
          {published && (
            <Button variant="outline" size="sm" onClick={onAddEntry}>
              Add one
            </Button>
          )}

          {/* ⚠️ **One visible verb and a menu**, the same shape the form library's card settled on: a
              card whose chrome is taller than its content has stopped being a card. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="More" title="More">
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onPreview}>Preview</DropdownMenuItem>
              <DropdownMenuItem onSelect={onManage}>Manage</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
      // ⚠️ A door rather than a peer action — this screen is about what the workshop stocks, and the
      // schema behind a type is a level down. See `LevelDoor` for why the two must not mix.
      //
      // ⚠️ It says *Schema*, not *Manage*, since 2026-08-25: managing a type is now a real thing beside
      // it (where it is filed, whether it is shared, how its rows are summarised), and two different
      // destinations cannot both be called the same word.
      door={<LevelDoor label="Schema" onOpen={onOpenSchema} />}
      onDelete={onDelete}
      confirmMessage={`Really delete “${form.name}”`}
    />
  )
}

/**
 * The types under their categories, with the uncategorised ones last.
 *
 * ⚠️ **Last rather than first, and never hidden.** A type with no category is usually one somebody has
 * just made and not filed yet — it has to be findable, and it has to look unfinished.
 */
function groupByCategory(forms: SpaceForm[]) {
  const byCategory = new Map<string, { id: string; name: string; icon: string | null; forms: SpaceForm[] }>()
  const uncategorised: SpaceForm[] = []

  for (const form of forms) {
    if (!form.category) {
      uncategorised.push(form)
      continue
    }

    const existing = byCategory.get(form.category.id)

    if (existing) {
      existing.forms.push(form)
    } else {
      byCategory.set(form.category.id, {
        id: form.category.id,
        name: form.category.name,
        icon: form.category.icon ?? null,
        forms: [form],
      })
    }
  }

  const groups = [...byCategory.values()].sort((left, right) => left.name.localeCompare(right.name))

  if (uncategorised.length > 0) {
    groups.push({ id: UNCATEGORISED, name: "Uncategorised", icon: null, forms: uncategorised })
  }

  return groups
}
