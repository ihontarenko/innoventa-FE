import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Skeleton,
} from "@jmouse/ui"
import { optionSourcesApi, type OptionPage } from "@/api/optionSources"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { useLinkCatalogEntry } from "@/hooks/useProjects"
import { useSpaceStore } from "@/stores/spaceStore"
import type { ProjectMaterial } from "@/api/projects"

/**
 * Saying which catalogue part a bill-of-materials line actually is.
 *
 * <h2>⚠️ Without this a line imported unidentified could never be identified</h2>
 *
 * The backend has had `linkCatalogEntry` since projects existed, and the new interface reached it from
 * nowhere: a schematic drawn by hand, or one whose MPN column names a part this workspace does not
 * keep, produced rows reading *"does not say which part it is"* forever. Coverage, reservation and
 * issuing all hang off that link, so an unidentified line is a line the whole screen can say nothing
 * about.
 *
 * <h2>⚠️ The choices come from the option source, not from a listing</h2>
 *
 * A part is an entry of any of forty-four component types, each naming its part number in a different
 * field — so a picker built on the entries listing would have to fetch forty-four schemas to know what
 * to print, and would still get `SS34` and `Vishay` mixed up. `purpose-entries` is the source the
 * inventory form's own part field already uses: the server resolves each label the way that picker
 * does, and reads `SS34 · Diodes`. One request, one answer, and the two pickers cannot disagree.
 *
 * ⚠️ **The description is what the search starts from.** A line already says `10k 0805 1%`; typing it
 * again to find the part it obviously is would be the dialog ignoring what it was opened from.
 */
export function ChoosePartDialog({
  projectId,
  material,
  onClose,
}: {
  projectId: string
  material: ProjectMaterial
  onClose: () => void
}) {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)
  const [search, setSearch] = useState(material.componentDescription ?? "")
  const query = useDebouncedValue(search.trim(), 300)

  const link = useLinkCatalogEntry()

  const { data, isLoading } = useQuery<OptionPage>({
    queryKey: ["option-preview", "catalog-parts", spaceId, query],
    queryFn: () =>
      optionSourcesApi
        .preview({ source: "purpose-entries", parameters: { purpose: "CATALOG" }, query: query || null })
        .then((response) => response.data),
    enabled: Boolean(spaceId),
  })

  const parts = data?.items ?? []

  function choose(catalogEntryId: string, label: string) {
    link.mutate(
      { projectId, materialId: material.id, catalogEntryId },
      {
        onSuccess: () => {
          toast.success(`${label} — that is what this line is.`)
          onClose()
        },
        onError: (error) => {
          const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail

          toast.error(detail ?? "That was not linked.")
        },
      },
    )
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Which part is this?</DialogTitle>
          <DialogDescription>
            {material.referenceDesignator ? `${material.referenceDesignator} · ` : ""}
            {material.componentDescription} — pick the catalogue part it is. Everything about this line
            follows from that: what is held of it, what is claimed, and whether it can be taken off the
            shelf.
          </DialogDescription>
        </DialogHeader>

        <Input
          autoFocus
          value={search}
          placeholder="Part number, name, component type…"
          onChange={(event) => setSearch(event.target.value)}
        />

        {isLoading ? (
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : parts.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
            {query
              ? "No catalogue part matches. The catalogue records what a component is — add one there first."
              : "This workspace has no catalogue parts yet."}
          </p>
        ) : (
          <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
            {parts.map((part) => (
              <button
                key={part.value}
                type="button"
                disabled={link.isPending}
                className="rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50"
                onClick={() => choose(part.value, part.label)}
              >
                {part.label}
              </button>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
