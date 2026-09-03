import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Row,
  RowGroup,
  RowList,
  RowMeta,
  RowTitle,
  Skeleton,
  Textarea,
} from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { ToggleChip } from "@/components/ToggleChip"
import { DependantProjectsPane } from "@/components/inventory/DependantProjectsPane"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { EditorField } from "@/components/form/builder/EditorSection"
import {
  useCreateLocation,
  useDeleteLocation,
  useLocationContents,
  useStorageLocations,
  useUpdateLocation,
} from "@/hooks/useStorageLocations"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useAddress } from "@/hooks/useAddress"
import { useSpaceStore } from "@/stores/spaceStore"
import type { StorageLocation, StorageLocationKind } from "@/api/storageLocations"

/**
 * What kind of place, and the glyph that says so at a glance.
 *
 * ⚠️ **`SITE` is somewhere things *are*; the rest are things they are *in*.** That is the one distinction
 * worth carrying, and it is why a site is offered as the default at the top level and a bin inside one.
 */
const KINDS: Array<{ value: StorageLocationKind; glyph: string; label: string }> = [
  { value: "SITE", glyph: "🏗️", label: "Site" },
  { value: "ROOM", glyph: "🚪", label: "Room" },
  { value: "CABINET", glyph: "🗄️", label: "Cabinet" },
  { value: "SHELF", glyph: "🪟", label: "Shelf" },
  { value: "DRAWER", glyph: "🗃️", label: "Drawer" },
  { value: "BIN", glyph: "📦", label: "Bin" },
  { value: "BOX", glyph: "📦", label: "Box" },
  { value: "OTHER", glyph: "📍", label: "Other" },
]

const GLYPHS = Object.fromEntries(KINDS.map((kind) => [kind.value, kind.glyph])) as Record<
  StorageLocationKind,
  string
>

interface Draft {
  id: string | null
  parentId: string | null
  name: string
  kind: StorageLocationKind
  notes: string
}

/**
 * Where things physically are.
 *
 * ⚠️ **A tree, and the tree is the screen.** A flat list of "Drawer 3" is useless the moment there are
 * two cabinets; the whole value of this is the ancestry, which is why the server builds a `path` and why
 * a row shows it rather than only its own name.
 *
 * ⚠️ **A location's count is what sits in it *directly*.** A cabinet holding four drawers of twenty
 * things each reads as zero, and that is correct — the alternative is a number that means neither "here"
 * nor "under here" and cannot be reconciled with either list.
 *
 * ⚠️ **Nothing here is a file store.** These are rooms and drawers; the migration under way on the file
 * endpoints does not reach them.
 */
export function LocationsPage() {
  const navigate = useNavigate()
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)

  const { data: tree = [], isLoading } = useStorageLocations()

  const { parameters, amend } = useAddress()

  const createLocation = useCreateLocation()
  const updateLocation = useUpdateLocation()
  const deleteLocation = useDeleteLocation()

  /**
   * Which place is open, kept in the ADDRESS.
   *
   * ⚠️ **A selection in local state is a selection nothing can link to.** A record says where it is
   * kept; pressing that has to arrive at the place itself, not at the tree with nothing chosen. Held
   * here it is also pasteable, which is the same reason a record has a page of its own.
   */
  const selectedId = parameters.get("location")
  /* ⚠️ `replace`, so walking a tree does not fill the Back button with every node touched on the way. */
  const setSelectedId = (locationId: string | null) => amend({ location: locationId })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  /**
   * ⚠️ **In the address, because "the cabinet, everything under it" is a different answer.** A person
   * who sent somebody a link to a place meant one of the two; keeping the choice in component state
   * would make the link mean whichever the recipient's screen happened to be set to.
   */
  const deep = parameters.get("deep") === "1"
  const { data: contents = [] } = useLocationContents(selectedId ?? undefined, deep)

  // Flattened once, with depth, so the list can be searched and drawn without walking the tree twice.
  const flattened = useMemo(() => flatten(tree), [tree])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()

    if (needle === "") {
      return flattened
    }

    // ⚠️ Matched on the *path*, so searching "cabinet a" finds the drawers inside it too — which is what
    // somebody typing a container's name is looking for.
    return flattened.filter(
      (node) =>
        node.location.name.toLowerCase().includes(needle) ||
        node.location.path.toLowerCase().includes(needle),
    )
  }, [flattened, search])

  const selected = flattened.find((node) => node.location.id === selectedId)?.location ?? null

  function save() {
    if (!draft) {
      return
    }

    const payload = {
      name: draft.name.trim(),
      kind: draft.kind,
      notes: draft.notes.trim() || undefined,
      parentId: draft.parentId,
    }

    const onError = (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail

      toast.error(detail ?? "That place was not saved.")
    }

    if (draft.id) {
      updateLocation.mutate({ locationId: draft.id, ...payload }, { onSuccess: () => setDraft(null), onError })

      return
    }

    createLocation.mutate(payload, { onSuccess: () => setDraft(null), onError })
  }

  return (
    <>
      <PageHeader
        title="Locations"
        description={`${flattened.length} places — rooms, cabinets, drawers, bins`}
        actions={
          <>
            <Input
              className="h-8 w-56 text-sm"
              value={search}
              placeholder="Search places…"
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button
              size="sm"
              onClick={() => setDraft({ id: null, parentId: null, name: "", kind: "SITE", notes: "" })}
            >
              New place
            </Button>
          </>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-3">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
              <span aria-hidden="true" className="text-2xl">
                📍
              </span>
              <span className="text-sm font-medium">
                {flattened.length === 0 ? "No places yet" : "Nothing matches"}
              </span>
              <span className="max-w-md text-xs text-muted-foreground">
                Start with where things are — a room, a bench, a site — and put cabinets and drawers under
                it. Anything held can then be filed in one.
              </span>
            </div>
          ) : (
            <RowList>
              {visible.map(({ location, depth }) => (
                <div key={location.id} style={{ marginLeft: `${depth * 1.25}rem` }}>
                  <Row
                    onOpen={() => setSelectedId(location.id === selectedId ? null : location.id)}
                    className={cn(location.id === selectedId && "bg-accent")}
                    leading={<span aria-hidden="true">{GLYPHS[location.kind]}</span>}
                    trailing={
                      removingId === location.id ? (
                        <>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              deleteLocation.mutate(location.id, {
                                onSuccess: () => toast.success(`${location.name} removed.`),
                                onError: (error) => {
                                  const detail = (error as { response?: { data?: { detail?: string } } })
                                    .response?.data?.detail

                                  // ⚠️ The backend's own sentence — it knows whether the refusal is
                                  // "something is filed here" or "it has children", and those are fixed
                                  // in two different places.
                                  toast.error(detail ?? "That place was not removed.")
                                },
                              })
                              setRemovingId(null)
                            }}
                          >
                            Really delete
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setRemovingId(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          {location.itemCount > 0 && <Badge variant="secondary">{location.itemCount}</Badge>}

                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 transition-opacity group-hover/row:opacity-100"
                            onClick={() =>
                              setDraft({
                                id: null,
                                parentId: location.id,
                                name: "",
                                kind: "BIN",
                                notes: "",
                              })
                            }
                          >
                            Add inside
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 transition-opacity group-hover/row:opacity-100"
                            onClick={() =>
                              setDraft({
                                id: location.id,
                                parentId: location.parentId,
                                name: location.name,
                                kind: location.kind,
                                notes: location.notes ?? "",
                              })
                            }
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive opacity-0 transition-opacity group-hover/row:opacity-100 hover:bg-destructive/10"
                            onClick={() => setRemovingId(location.id)}
                          >
                            Delete
                          </Button>
                        </>
                      )
                    }
                  >
                    <RowTitle>{location.name}</RowTitle>
                    {location.notes && <RowMeta>{location.notes}</RowMeta>}
                  </Row>
                </div>
              ))}
            </RowList>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-2">
          {selected ? (
            <>
              <RowGroup
                label={selected.path}
                tally={`${contents.length} ${deep ? "in all" : "here"}`}
              >
                {/* ⚠️ **Offered only where there is something inside**, because on a drawer the two
                    answers are the same one and a toggle that changes nothing reads as broken. */}
                {selected.children.length > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px]">
                    <ToggleChip
                      active={deep}
                      title="Count what is filed in the places inside this one too"
                      onClick={() => amend({ deep: deep ? null : "1" })}
                    >
                      Include nested
                    </ToggleChip>
                  </div>
                )}

                {contents.length === 0 ? (
                  <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                    Nothing is filed directly in {selected.name}.
                    {/* ⚠️ Said explicitly, because a container whose children are full reads as empty
                        here and that looks like a fault rather than an answer. */}
                    {!deep && selected.children.length > 0 && " What is inside it is filed in its own places."}
                  </p>
                ) : (
                  <RowList>
                    {contents.map((item) => (
                      <Row
                        key={item.entryId}
                        /* ⚠️ The form's **id**. This was built from `formName`, so every row led to
                           `/entry/Inventory/abc` — a route that resolves to nothing. */
                        onOpen={() =>
                          spaceSlug && navigate(spaceSectionPath(spaceSlug, `entry/${item.formId}/${item.entryId}`))
                        }
                      >
                        <RowTitle>{item.label}</RowTitle>
                        <RowMeta>
                          {item.formName}
                          {/* Where exactly, and only when it is not the place already named above. */}
                          {item.location && ` · ${item.location}`}
                        </RowMeta>
                      </Row>
                    ))}
                  </RowList>
                )}
              </RowGroup>

              {/* ⚠️ Below the contents, because it is a consequence of them: these are the projects
                  that would notice if any of this moved. */}
              <RowGroup label="Projects that depend on this">
                <DependantProjectsPane locationId={selected.id} />
              </RowGroup>
            </>
          ) : (
            <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
              Pick a place to see what is filed in it.
            </p>
          )}
        </aside>
      </div>

      {draft && (
        <Dialog open onOpenChange={(next) => !next && setDraft(null)}>
          <DialogContent className="flex flex-col gap-3 sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{draft.id ? "Edit place" : "New place"}</DialogTitle>
              <DialogDescription>
                {draft.parentId
                  ? `Inside ${flattened.find((node) => node.location.id === draft.parentId)?.location.path ?? "…"}.`
                  : "At the top level — a site, a room, a bench."}
              </DialogDescription>
            </DialogHeader>

            <div className="flex gap-2">
              <EditorField label="Kind">
                <PlainSelect
                  value={draft.kind}
                  onChange={(next) => setDraft({ ...draft, kind: next as StorageLocationKind })}
                >
                  {KINDS.map((kind) => (
                    <option key={kind.value} value={kind.value}>
                      {kind.glyph} {kind.label}
                    </option>
                  ))}
                </PlainSelect>
              </EditorField>

              <EditorField label="Name">
                <Input
                  autoFocus
                  className="h-8 text-sm"
                  value={draft.name}
                  placeholder="Drawer 3"
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </EditorField>
            </div>

            <EditorField label="Inside" hint="Moving a place takes everything under it with it.">
              <PlainSelect
                value={draft.parentId ?? ""}
                onChange={(next) => setDraft({ ...draft, parentId: next || null })}
              >
                <option value="">— top level —</option>
                {flattened
                  // ⚠️ A place cannot be moved inside itself. Its descendants would also be illegal, but
                  // the backend refuses those and its message names the cycle better than a filter could.
                  .filter((node) => node.location.id !== draft.id)
                  .map((node) => (
                    <option key={node.location.id} value={node.location.id}>
                      {"— ".repeat(node.depth)}
                      {node.location.name}
                    </option>
                  ))}
              </PlainSelect>
            </EditorField>

            <EditorField label="Notes" hint="Anything the name does not say.">
              <Textarea
                rows={2}
                className="text-sm"
                value={draft.notes}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              />
            </EditorField>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button
                disabled={!draft.name.trim() || createLocation.isPending || updateLocation.isPending}
                onClick={save}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

/** ⚠️ Depth-first, so the flat list reads in tree order and an indent is all the structure it needs. */
function flatten(
  nodes: StorageLocation[],
  depth = 0,
): Array<{ location: StorageLocation; depth: number }> {
  return nodes.flatMap((location) => [
    { location, depth },
    ...flatten(location.children ?? [], depth + 1),
  ])
}
