import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge, Button, Input, Row, RowGroup, RowKey, RowList, RowMeta, RowTitle, Skeleton } from "@jmouse/ui"
import { AccessDenied } from "@/components/AccessDenied"
import { Callout } from "@/components/Callout"
import { GlyphInput } from "@/components/GlyphInput"
import { PageHeader } from "@/components/PageHeader"
import { EditorField } from "@/components/form/builder/EditorSection"
import {
  useCategories,
  useCreateCategory,
  useCreatePurpose,
  useDeleteCategory,
  useDeletePurpose,
  usePurposes,
  useUpdateCategory,
  useUpdatePurpose,
} from "@/hooks/useWorkspaceForms"
import { useAuthStore } from "@/stores/authStore"
import { platformItem, requiredPermissionsOf } from "@/navigation"

/** The declaration this screen is reached by — asked, never re-typed. See `AccessRequirement`. */
const PURPOSES = platformItem("purposes")
import type { FormCategory, FormPurpose } from "@/types"

/**
 * What a form is *for*, and the headings those intents are filed under.
 *
 * ⚠️ **An installation screen, not a workspace one, and the tables say so.** `form_purposes` and
 * `form_categories` carry no workspace column: one row is read by every workspace here, so editing a
 * purpose from inside one would be a settings screen quietly changing what the workspace next door
 * shows. That is the whole reason it sits in Administration rather than in a workspace's menu.
 *
 * ⚠️ **A purpose carries behaviour; a category is only a heading.** `INVENTORY` is what makes a form a
 * component type — screens branch on a purpose's **code**, never on a form's identifier — while a
 * category decides nothing but which run of cards a form appears under. Which is why the code is set
 * once at creation and never edited: renaming it would silently unmake every form that carries it.
 *
 * ⚠️ **A system purpose is read-only here.** It is seeded, and something in the product depends on its
 * code existing; offering an edit that the backend refuses is worse than not offering it.
 */
export function PurposesPage() {
  const mayOpen = useAuthStore((state) => state.holds)

  // ⚠️ **The one entry on the Administration screen whose gate is NOT installation-wide, and the
  // correction went the other way.** `Permissions.java` maps `purpose:read` to `AccessScope.SPACE` and
  // `FormPurposeController` declares `scope = Scopes.SPACE`, so the backend answers this to anybody who
  // holds it in a workspace — while this screen was asking `holdsEverywhere` and refusing them. The
  // screen was stricter than the server, which discloses nothing extra and simply locked people out of
  // a list every workspace already reads. The declaration is now the single answer.
  const canRead = mayOpen(PURPOSES)

  // A WRITE gate: `purpose:write` leads to no menu row and has no declaration to ask. The
  // one-declaration rule is about a destination's door, not about every control behind it.
  const canWrite = useAuthStore((state) => state.holdsSomewhere)("purpose:write")

  const { data: purposes = [], isLoading } = usePurposes()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // The first purpose is opened for you — a two-pane screen whose second pane starts empty reads as
  // half-broken, and there is always at least one seeded purpose.
  useEffect(() => {
    if (!selectedId && purposes.length > 0) {
      setSelectedId(purposes[0].id)
    }
  }, [purposes, selectedId])

  if (!canRead) {
    return (
      <AccessDenied
        title="Purposes"
        why="A purpose is read by every workspace in this installation, and this account holds that in none of them."
        permissions={requiredPermissionsOf(PURPOSES)}
      />
    )
  }

  const selected = purposes.find((purpose) => purpose.id === selectedId) ?? null

  return (
    <>
      <PageHeader
        title="Purposes"
        description="What a form is for, and the headings its forms are filed under — read by every workspace in this installation"
      />

      {!canWrite && (
        <Callout tone="info">
          <span>
            You may read this vocabulary but not change it. Editing needs{" "}
            <code className="font-mono text-[11px]">purpose:write</code>.
          </span>
        </Callout>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <PurposesPane
            purposes={purposes}
            selectedId={selectedId}
            canWrite={canWrite}
            onSelect={setSelectedId}
          />
        )}

        {selected ? (
          <CategoriesPane purpose={selected} canWrite={canWrite} />
        ) : (
          <p className="text-xs text-muted-foreground">Pick a purpose to see the headings under it.</p>
        )}
      </div>
    </>
  )
}

function PurposesPane({
  purposes,
  selectedId,
  canWrite,
  onSelect,
}: {
  purposes: FormPurpose[]
  selectedId: string | null
  canWrite: boolean
  onSelect: (id: string) => void
}) {
  const createPurpose = useCreatePurpose()
  const updatePurpose = useUpdatePurpose()
  const deletePurpose = useDeletePurpose()

  const [isAdding, setAdding] = useState(false)
  const [code, setCode] = useState("")
  const [label, setLabel] = useState("")
  const [icon, setIcon] = useState("")
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftLabel, setDraftLabel] = useState("")

  function add() {
    createPurpose.mutate(
      { code: code.trim().toUpperCase(), label: label.trim(), icon: icon.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(`${label.trim()} added.`)
          setCode("")
          setLabel("")
          setIcon("")
          setAdding(false)
        },
        onError: (error) => {
          const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail

          toast.error(detail ?? "That purpose was not created.")
        },
      },
    )
  }

  return (
    <RowGroup
      label="Purposes"
      tally={`${purposes.length}`}
      action={
        canWrite && !isAdding ? (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            New purpose
          </Button>
        ) : undefined
      }
    >
      {isAdding && (
        <div className="flex flex-col gap-2 rounded-md border p-3">
          <div className="flex gap-2">
            <EditorField label="Glyph">
              <GlyphInput value={icon} onChange={setIcon} placeholder="📦" />
            </EditorField>

            <EditorField label="Label">
              <Input
                autoFocus
                className="h-8 text-sm"
                value={label}
                placeholder="Inventory"
                onChange={(event) => setLabel(event.target.value)}
              />
            </EditorField>
          </div>

          <EditorField
            label="Code"
            hint="⚠️ Set once and never edited — screens branch on it, so renaming it would unmake every form that carries it."
          >
            <Input
              className="h-8 font-mono text-sm uppercase"
              value={code}
              placeholder="INVENTORY"
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
          </EditorField>

          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!code.trim() || !label.trim() || createPurpose.isPending}
              onClick={add}
            >
              Create
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <RowList>
        {purposes.map((purpose) => (
          <Row
            key={purpose.id}
            variant="carded"
            onOpen={() => onSelect(purpose.id)}
            className={purpose.id === selectedId ? "border-primary/50 bg-accent" : undefined}
            leading={<span aria-hidden="true">{purpose.icon ?? "📄"}</span>}
            trailing={
              purpose.system ? (
                <Badge variant="outline" title="Seeded, and something in the product depends on its code">
                  system
                </Badge>
              ) : canWrite ? (
                removingId === purpose.id ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      deletePurpose.mutate(purpose.id, {
                        onSuccess: () => toast.success("Purpose removed."),
                        onError: (error) => {
                          const detail = (error as { response?: { data?: { detail?: string } } }).response?.data
                            ?.detail

                          // ⚠️ The backend's own sentence. "Could not delete" hides the useful fact —
                          // that forms still carry it — and sends somebody looking at permissions.
                          toast.error(detail ?? "That purpose was not removed.")
                        },
                      })
                      setRemovingId(null)
                    }}
                  >
                    Really delete
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 transition-opacity group-hover/row:opacity-100"
                      onClick={() => {
                        setEditingId(purpose.id)
                        setDraftLabel(purpose.label)
                      }}
                    >
                      Rename
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive opacity-0 transition-opacity group-hover/row:opacity-100 hover:bg-destructive/10"
                      onClick={() => setRemovingId(purpose.id)}
                    >
                      Delete
                    </Button>
                  </>
                )
              ) : undefined
            }
          >
            {editingId === purpose.id ? (
              <span className="flex items-center gap-1.5">
                <Input
                  autoFocus
                  className="h-7 text-sm"
                  value={draftLabel}
                  onChange={(event) => setDraftLabel(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setEditingId(null)
                    }

                    if (event.key === "Enter" && draftLabel.trim()) {
                      updatePurpose.mutate(
                        { purposeId: purpose.id, label: draftLabel.trim() },
                        { onSuccess: () => setEditingId(null) },
                      )
                    }
                  }}
                />
              </span>
            ) : (
              <RowTitle>{purpose.label}</RowTitle>
            )}
            <span className="flex items-baseline gap-2">
              <RowKey>{purpose.code}</RowKey>
              {purpose.description && <RowMeta>{purpose.description}</RowMeta>}
            </span>
          </Row>
        ))}
      </RowList>
    </RowGroup>
  )
}

/**
 * The headings under one purpose.
 *
 * ⚠️ **They belong to the purpose, not to the installation.** The categories under `INVENTORY` mean
 * nothing under `FEEDBACK`, which is exactly why moving a form between purposes empties its category
 * rather than carrying it across.
 */
function CategoriesPane({ purpose, canWrite }: { purpose: FormPurpose; canWrite: boolean }) {
  const { data: categories = [], isLoading } = useCategories(purpose.id)

  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()

  const [name, setName] = useState("")
  const [icon, setIcon] = useState("")
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState("")

  function add() {
    createCategory.mutate(
      { purposeId: purpose.id, name: name.trim(), icon: icon.trim() || undefined },
      {
        onSuccess: () => {
          setName("")
          setIcon("")
        },
        onError: (error) => {
          const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail

          toast.error(detail ?? "That heading was not created.")
        },
      },
    )
  }

  return (
    <RowGroup
      label={`Headings under ${purpose.label}`}
      tally={isLoading ? undefined : `${categories.length}`}
    >
      {canWrite && (
        <div className="flex items-end gap-2">
          <GlyphInput value={icon} onChange={setIcon} />
          <Input
            className="h-8 flex-1 text-sm"
            value={name}
            placeholder="Passives"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && name.trim() && add()}
          />
          <Button size="sm" disabled={!name.trim() || createCategory.isPending} onClick={add}>
            Add
          </Button>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : categories.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          Nothing is filed under {purpose.label} yet. A heading groups forms in the library and decides
          nothing else.
        </p>
      ) : (
        <RowList>
          {categories.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              canWrite={canWrite}
              isEditing={editingId === category.id}
              isRemoving={removingId === category.id}
              draftName={draftName}
              onDraftChange={setDraftName}
              onStartEdit={() => {
                setEditingId(category.id)
                setDraftName(category.name)
              }}
              onCancelEdit={() => setEditingId(null)}
              onCommitEdit={() =>
                updateCategory.mutate(
                  { categoryId: category.id, name: draftName.trim() },
                  { onSuccess: () => setEditingId(null) },
                )
              }
              onAskRemove={() => setRemovingId(category.id)}
              onRemove={() => {
                deleteCategory.mutate(category.id, {
                  onError: (error) => {
                    const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail

                    toast.error(detail ?? "That heading was not removed.")
                  },
                })
                setRemovingId(null)
              }}
            />
          ))}
        </RowList>
      )}
    </RowGroup>
  )
}

function CategoryRow({
  category,
  canWrite,
  isEditing,
  isRemoving,
  draftName,
  onDraftChange,
  onStartEdit,
  onCancelEdit,
  onCommitEdit,
  onAskRemove,
  onRemove,
}: {
  category: FormCategory
  canWrite: boolean
  isEditing: boolean
  isRemoving: boolean
  draftName: string
  onDraftChange: (value: string) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onCommitEdit: () => void
  onAskRemove: () => void
  onRemove: () => void
}) {
  return (
    <Row
      leading={<span aria-hidden="true">{category.icon ?? "◫"}</span>}
      trailing={
        canWrite ? (
          isRemoving ? (
            <Button variant="destructive" size="sm" onClick={onRemove}>
              Really delete
            </Button>
          ) : isEditing ? (
            <>
              <Button size="sm" disabled={!draftName.trim()} onClick={onCommitEdit}>
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={onCancelEdit}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 transition-opacity group-hover/row:opacity-100"
                onClick={onStartEdit}
              >
                Rename
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive opacity-0 transition-opacity group-hover/row:opacity-100 hover:bg-destructive/10"
                onClick={onAskRemove}
              >
                Delete
              </Button>
            </>
          )
        ) : undefined
      }
    >
      {isEditing ? (
        <Input
          autoFocus
          className="h-7 text-sm"
          value={draftName}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onCancelEdit()
            }

            if (event.key === "Enter" && draftName.trim()) {
              onCommitEdit()
            }
          }}
        />
      ) : (
        <RowTitle>{category.name}</RowTitle>
      )}
      {category.description && <RowMeta>{category.description}</RowMeta>}
    </Row>
  )
}
