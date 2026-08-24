import { useState } from "react"
import { toast } from "sonner"
import { Badge, Button, Input, cn } from "@jmouse/ui"
import {
  useDeleteMaterial,
  useReleaseStock,
  useReserveStock,
  useToggleMaterialExcluded,
  useUnlinkStockEntry,
  useUpdateMaterial,
} from "@/hooks/useProjects"
import type { MaterialCoverageStatus } from "@/api/projects"
import type { ProjectMaterial } from "@/api/projects"

/**
 * How a line is painted.
 *
 * ⚠️ **Unsourced is not a warning.** A line nobody has pointed at stock yet is ordinary early work;
 * painting it amber alongside a genuine shortage is how a screen cries wolf on a project that has just
 * been imported.
 */
const TONES: Record<MaterialCoverageStatus, string> = {
  COVERED: "",
  SHORTAGE: "border-l-2 border-l-destructive bg-destructive/5",
  UNSOURCED: "",
  EXCLUDED: "opacity-50",
}

const LABELS: Record<MaterialCoverageStatus, string> = {
  COVERED: "covered",
  SHORTAGE: "short",
  UNSOURCED: "unsourced",
  EXCLUDED: "excluded",
}

/**
 * One line of a bill of materials, with everything that can be done to it.
 *
 * ⚠️ **Three numbers, and they are three different questions.** *Need* is the design's; *have* is what
 * is in the drawer; *available* is what is in the drawer **minus what other projects have claimed** — so
 * a line can be short while the stock room looks full. Showing only the first two is how two projects
 * both plan to build from the same forty resistors.
 */
export function MaterialRow({
  projectId,
  material,
  isBlocking,
}: {
  projectId: string
  material: ProjectMaterial
  isBlocking: boolean
}) {
  const updateMaterial = useUpdateMaterial()
  const deleteMaterial = useDeleteMaterial()
  const toggleExcluded = useToggleMaterialExcluded()
  const unlinkStock = useUnlinkStockEntry()
  const reserveStock = useReserveStock()
  const releaseStock = useReleaseStock()

  const [editing, setEditing] = useState(false)
  const [description, setDescription] = useState(material.componentDescription)
  const [quantity, setQuantity] = useState(String(material.quantityRequired))
  const [removing, setRemoving] = useState(false)
  const [reserving, setReserving] = useState(false)
  const [reserveAmount, setReserveAmount] = useState("")

  const isSourced = material.stockEntryId !== null

  return (
    <div
      className={cn(
        "group/line flex flex-col gap-1.5 rounded-md border p-2.5 text-sm transition-colors",
        TONES[material.coverageStatus],
        // ⚠️ A ring rather than a colour: the line may already be painted for its coverage, and two
        // meanings fighting over one background is how neither gets read.
        isBlocking && "ring-1 ring-amber-500/60",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
          {material.referenceDesignator ?? "—"}
        </span>

        {editing ? (
          <Input
            autoFocus
            className="h-7 flex-1 text-sm"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setEditing(false)
              }

              if (event.key === "Enter" && description.trim()) {
                updateMaterial.mutate(
                  {
                    projectId,
                    materialId: material.id,
                    componentDescription: description.trim(),
                    quantityRequired: Number.parseInt(quantity, 10) || material.quantityRequired,
                  },
                  { onSuccess: () => setEditing(false), onError: () => toast.error("That was not saved.") },
                )
              }
            }}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate font-medium">{material.componentDescription}</span>
        )}

        <span className="flex shrink-0 items-baseline gap-3 font-mono text-xs">
          <span title="What the design needs">
            <span className="text-muted-foreground">need </span>
            {editing ? (
              <Input
                type="number"
                min={1}
                className="inline-block h-6 w-16 text-xs"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            ) : (
              material.quantityRequired
            )}
          </span>

          <span title="What is in the drawer">
            <span className="text-muted-foreground">have </span>
            {material.stockQuantityCached ?? "?"}
          </span>

          {/* ⚠️ Only when it differs from `have`. Repeating the same number twice teaches nobody that the
              two mean different things; showing it exactly when other projects have claimed some does. */}
          {material.availableQuantity !== null &&
            material.availableQuantity !== material.stockQuantityCached && (
              <span
                className="text-amber-600 dark:text-amber-400"
                title="On hand minus what other projects have reserved"
              >
                <span className="opacity-70">free </span>
                {material.availableQuantity}
              </span>
            )}
        </span>

        <Badge variant="outline" className="shrink-0">
          {LABELS[material.coverageStatus]}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {isSourced ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span aria-hidden="true">📦</span>
            {material.stockEntryNameCached ?? "linked stock"}
            {material.reservedQuantity !== null && material.reservedQuantity > 0 && (
              <Badge variant="secondary">{material.reservedQuantity} reserved</Badge>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">Not pointed at any stock yet.</span>
        )}

        {material.catalogPartNumberCached && (
          <Badge variant="outline" className="font-mono">
            {material.catalogPartNumberCached}
          </Badge>
        )}

        <span className="ml-auto flex flex-wrap items-center gap-1 opacity-0 transition-opacity group-hover/line:opacity-100 group-focus-within/line:opacity-100">
          {isSourced &&
            (reserving ? (
              <>
                <Input
                  autoFocus
                  type="number"
                  min={1}
                  className="h-6 w-20 text-xs"
                  value={reserveAmount}
                  placeholder={String(material.quantityRequired)}
                  onChange={(event) => setReserveAmount(event.target.value)}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    reserveStock.mutate(
                      {
                        projectId,
                        materialId: material.id,
                        quantity: Number.parseInt(reserveAmount, 10) || material.quantityRequired,
                      },
                      {
                        onSuccess: () => setReserving(false),
                        onError: (error) => {
                          const detail = (error as { response?: { data?: { detail?: string } } }).response
                            ?.data?.detail

                          // ⚠️ The backend's sentence: it knows whether the refusal is "not enough free"
                          // or "somebody else took it first", and those are acted on differently.
                          toast.error(detail ?? "That was not reserved.")
                        },
                      },
                    )
                  }}
                >
                  Reserve
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setReserving(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => setReserving(true)}>
                  Reserve
                </Button>
                {material.reservedQuantity !== null && material.reservedQuantity > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      releaseStock.mutate(
                        { projectId, materialId: material.id },
                        { onError: () => toast.error("That was not released.") },
                      )
                    }
                  >
                    Release
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    unlinkStock.mutate(
                      { projectId, materialId: material.id },
                      { onError: () => toast.error("That was not unlinked.") },
                    )
                  }
                >
                  Unlink
                </Button>
              </>
            ))}

          <Button
            variant="ghost"
            size="sm"
            title={
              material.excluded
                ? "Count it towards coverage again"
                : "Keep the line but leave it out of coverage — a do-not-fit, a part you already have elsewhere"
            }
            onClick={() =>
              toggleExcluded.mutate(
                { projectId, materialId: material.id },
                { onError: () => toast.error("That was not changed.") },
              )
            }
          >
            {material.excluded ? "Include" : "Exclude"}
          </Button>

          {editing ? (
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Done
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}

          {removing ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                deleteMaterial.mutate(
                  { projectId, materialId: material.id },
                  { onError: () => toast.error("That line was not deleted.") },
                )
                setRemoving(false)
              }}
            >
              Really delete
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setRemoving(true)}
            >
              Delete
            </Button>
          )}
        </span>
      </div>

      {material.notes && <p className="text-xs text-muted-foreground">{material.notes}</p>}
    </div>
  )
}
