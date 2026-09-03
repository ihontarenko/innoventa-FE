import { useState } from "react"
import { toast } from "sonner"
import { Badge, Button, Input, cn } from "@jmouse/ui"
import {
  useDeleteMaterial,
  useReleaseStock,
  useReserveStock,
  useToggleMaterialExcluded,
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
 * ⚠️ **Three numbers, and they are three different questions.** *Each* is what the design asks per
 * unit; *need* is that times the run size; *free* is everything held of the part **minus what other
 * projects have claimed** — so a line can be short while the stock room looks full. Showing only the
 * first is how two projects both plan to build from the same forty resistors.
 *
 * ⚠️ **`free` is summed over every place the part sits**, which is why the line no longer names one.
 */
export function MaterialRow({
  projectId,
  material,
  isBlocking,
  onChoosePart,
}: {
  projectId: string
  material: ProjectMaterial
  isBlocking: boolean
  /** Opens the picker that says which catalogue part this line is — every other figure follows from it. */
  onChoosePart: (material: ProjectMaterial) => void
}) {
  const updateMaterial = useUpdateMaterial()
  const deleteMaterial = useDeleteMaterial()
  const toggleExcluded = useToggleMaterialExcluded()
  const reserveStock = useReserveStock()
  const releaseStock = useReleaseStock()

  const [editing, setEditing] = useState(false)
  const [description, setDescription] = useState(material.componentDescription)
  const [quantity, setQuantity] = useState(String(material.quantityRequired))
  const [removing, setRemoving] = useState(false)
  const [reserving, setReserving] = useState(false)
  const [reserveAmount, setReserveAmount] = useState("")

  /**
   * ⚠️ **Truthiness, never `!== null`.** The backend serialises with `non_null` inclusion, so a line
   * that names no part arrives with **no `catalogEntryId` key at all** — and `undefined !== null` is
   * `true`. The test read as identified for every unidentified line, which is precisely the line the
   * screen exists to let somebody fix: the "Choose a part" button was never drawn, and the row showed
   * an empty part badge instead.
   */
  const isIdentified = Boolean(material.catalogEntryId)

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
          <span title="What the design needs per finished unit">
            <span className="text-muted-foreground">each </span>
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

          {/* ⚠️ Only when the run is more than one. On a prototype it repeats `each`, and a number
              printed twice teaches nobody that the two mean different things. */}
          {material.need !== material.quantityRequired && (
            <span title="Per unit times how many units this run is for">
              <span className="text-muted-foreground">need </span>
              {material.need}
            </span>
          )}

          <span title="Everything held of this part, minus what other projects have claimed">
            <span className="text-muted-foreground">free </span>
            {material.free}
          </span>

          {material.shortage > 0 && (
            <span className="text-destructive" title="How many of this part the whole BOM is missing">
              <span className="opacity-70">short </span>
              {material.shortage}
            </span>
          )}
        </span>

        <Badge variant="outline" className="shrink-0">
          {LABELS[material.coverageStatus]}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {isIdentified ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            {/* ⚠️ A button, not a badge. Saying which part a line is is the one decision every other
                figure on the row follows from, so changing it has to be reachable from the row that
                shows it — a wrong part is found by looking at this, never at a menu. */}
            <button
              type="button"
              title="Change which part this line is"
              className="rounded font-mono text-xs underline-offset-2 hover:underline"
              onClick={() => onChoosePart(material)}
            >
              <Badge variant="outline" className="font-mono">
                {material.catalogPartNumberCached ?? "part"}
              </Badge>
            </button>
            {/* ⚠️ Where it is, not which row it is: a part sits in as many boxes as it likes, and the
                count is what tells somebody whether they are walking to one shelf or four. */}
            <span title={material.positions.map((position) => position.locationPath ?? "—").join(" · ")}>
              {material.positions.length === 0
                ? "nowhere yet"
                : `in ${material.positions.length} place${material.positions.length === 1 ? "" : "s"}`}
            </span>
            {material.reserved > 0 && <Badge variant="secondary">{material.reserved} reserved</Badge>}
          </span>
        ) : (
          /* ⚠️ **An action, not a statement.** An unidentified line is not a fact about the project, it
             is the one thing stopping this row from being told anything about — so the sentence that
             says so is the control that fixes it. */
          <Button variant="outline" size="sm" onClick={() => onChoosePart(material)}>
            Choose a part
          </Button>
        )}

        <span className="ml-auto flex flex-wrap items-center gap-1 opacity-0 transition-opacity group-hover/line:opacity-100 group-focus-within/line:opacity-100">
          {isIdentified &&
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
                {material.reserved > 0 && (
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
