import { useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Badge, Button, Input, Skeleton, cn } from "@jmouse/ui"
import { Callout } from "@/components/Callout"
import { PageHeader } from "@/components/PageHeader"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { MaterialRow } from "@/components/project/MaterialRow"
import {
  useAddMaterial,
  useImportBom,
  useProject,
  useUpdateProject,
} from "@/hooks/useProjects"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useSpaceStore } from "@/stores/spaceStore"
import { PROJECT_STATUSES } from "@/pages/workspace/ProjectsPage"
import type { MaterialCoverageStatus } from "@/api/projects"
import type { ProjectStatus } from "@/api/projects"

/** The distributor exports the backend knows how to read. */
const IMPORT_PROVIDERS = [
  { id: "mouser", label: "Mouser" },
  { id: "digikey", label: "DigiKey" },
  { id: "generic", label: "Generic CSV" },
]

const COVERAGE_ORDER: MaterialCoverageStatus[] = ["SHORTAGE", "UNSOURCED", "COVERED", "EXCLUDED"]

const COVERAGE_LABEL: Record<MaterialCoverageStatus, string> = {
  SHORTAGE: "Short",
  UNSOURCED: "Unsourced",
  COVERED: "Covered",
  EXCLUDED: "Excluded",
}

/**
 * One project: its bill of materials, read against what is actually on the shelf.
 *
 * ⚠️ **The headline is "how many could I build today", and it is the server's answer.** Deriving it here
 * from the rows would be a second implementation of a rule that already exists — and the two would
 * disagree the first time somebody reserved stock from another project.
 *
 * ⚠️ **Every line at the ceiling is named, not just the first.** Three lines tied at two units means
 * ordering one of them raises nothing; a screen that named one would send somebody shopping for no gain.
 *
 * ⚠️ **Short and unsourced come first.** A bill of materials is opened to find what is missing, so the
 * order is by what needs doing rather than by the order somebody typed the lines in.
 */
export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)

  const { data: project, isLoading } = useProject(projectId)

  const updateProject = useUpdateProject()
  const addMaterial = useAddMaterial()
  const importBom = useImportBom()

  const [description, setDescription] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [reference, setReference] = useState("")
  const [provider, setProvider] = useState(IMPORT_PROVIDERS[0].id)
  const fileInput = useRef<HTMLInputElement>(null)

  const materials = useMemo(() => {
    if (!project) {
      return []
    }

    return [...project.materials].sort(
      (left, right) =>
        COVERAGE_ORDER.indexOf(left.coverageStatus) - COVERAGE_ORDER.indexOf(right.coverageStatus) ||
        left.sortOrder - right.sortOrder,
    )
  }, [project])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
        <span aria-hidden="true" className="text-2xl">
          ⌀
        </span>
        <span className="text-sm font-medium">No such project</span>
        <span className="max-w-md text-xs text-muted-foreground">
          It was deleted, or it belongs to a workspace you cannot reach.
        </span>
      </div>
    )
  }

  const { buildability } = project
  const blocking = new Set(buildability.blockingMaterialIds)

  function add() {
    addMaterial.mutate(
      {
        projectId: project!.id,
        componentDescription: description.trim(),
        quantityRequired: Number.parseInt(quantity, 10) || 1,
        referenceDesignator: reference.trim() || undefined,
      },
      {
        onSuccess: () => {
          setDescription("")
          setReference("")
          setQuantity("1")
        },
        onError: () => toast.error("That line was not added."),
      },
    )
  }

  return (
    <>
      <PageHeader
        title={project.name}
        description={project.description ?? `${project.totalMaterialCount} lines`}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => spaceSlug && navigate(spaceSectionPath(spaceSlug, "projects"))}
            >
              All projects
            </Button>

            <PlainSelect
              value={project.status}
              className="h-8 w-40 text-xs"
              onChange={(next) =>
                updateProject.mutate(
                  { projectId: project.id, status: next as ProjectStatus },
                  { onError: () => toast.error("The stage was not changed.") },
                )
              }
            >
              {PROJECT_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.glyph} {status.label}
                </option>
              ))}
            </PlainSelect>
          </>
        }
      />

      <div className="flex min-w-0 flex-col gap-4">
        <BuildabilityBanner
          buildable={buildability.buildableQuantity}
          limiting={buildability.limitingMaterialLabel}
          blockingCount={buildability.blockingMaterialIds.length}
          hasLines={project.totalMaterialCount > 0}
        />

        {/* ── Adding a line ────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
          <label className="flex w-28 flex-col gap-1">
            <span className="text-xs font-medium">Ref</span>
            <Input
              className="h-8 font-mono text-sm"
              value={reference}
              placeholder="R1, R2"
              onChange={(event) => setReference(event.target.value)}
            />
          </label>

          <label className="flex min-w-56 flex-1 flex-col gap-1">
            <span className="text-xs font-medium">Component</span>
            <Input
              className="h-8 text-sm"
              value={description}
              placeholder="10k 0805 1%"
              onChange={(event) => setDescription(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && description.trim() && add()}
            />
          </label>

          <label className="flex w-20 flex-col gap-1">
            <span className="text-xs font-medium">Need</span>
            <Input
              type="number"
              min={1}
              className="h-8 font-mono text-sm"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>

          <Button size="sm" disabled={!description.trim() || addMaterial.isPending} onClick={add}>
            Add line
          </Button>

          <span className="ml-auto flex items-end gap-2">
            <PlainSelect value={provider} className="h-8 w-36 text-xs" onChange={setProvider}>
              {IMPORT_PROVIDERS.map((one) => (
                <option key={one.id} value={one.id}>
                  {one.label}
                </option>
              ))}
            </PlainSelect>

            <input
              ref={fileInput}
              type="file"
              accept=".csv,.xls,.xlsx,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]

                if (!file) {
                  return
                }

                importBom.mutate(
                  { projectId: project.id, provider, file },
                  {
                    onSuccess: (result) => {
                      // ⚠️ Partial success is the normal outcome, so the message reports both halves.
                      // "Imported" alone would hide twelve rejected rows behind a tick.
                      const failed = result.errors.length + result.skipped

                      if (failed === 0) {
                        toast.success(`${result.items.length} lines imported.`)
                      } else {
                        toast.warning(
                          `${result.items.length} of ${result.total} imported — ${failed} could not be read.`,
                        )
                      }
                    },
                    onError: (error) => {
                      const detail = (error as { response?: { data?: { detail?: string } } }).response?.data
                        ?.detail

                      toast.error(detail ?? "That file was not imported.")
                    },
                  },
                )

                event.target.value = ""
              }}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={importBom.isPending}
              onClick={() => fileInput.current?.click()}
            >
              Import BOM
            </Button>
          </span>
        </div>

        {/* ── The bill of materials ────────────────────────────────────────── */}
        {materials.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
            <span aria-hidden="true" className="text-2xl">
              ▤
            </span>
            <span className="text-sm font-medium">No lines yet</span>
            <span className="max-w-md text-xs text-muted-foreground">
              Add one above, or import a distributor's export. Each line is then pointed at the stock that
              fills it, and at the catalogue part it actually is.
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {materials.map((material) => (
              <MaterialRow
                key={material.id}
                projectId={project.id}
                material={material}
                isBlocking={blocking.has(material.id)}
              />
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
          {COVERAGE_ORDER.filter((status) => materials.some((material) => material.coverageStatus === status)).map(
            (status) => (
              <Badge key={status} variant="outline">
                {COVERAGE_LABEL[status]} ·{" "}
                {materials.filter((material) => material.coverageStatus === status).length}
              </Badge>
            ),
          )}
        </div>
      </div>
    </>
  )
}

/**
 * ⚠️ **The number, and then what to do about it.** "3 buildable" is a fact; "3, and the regulator is
 * what stops it being more" is the sentence somebody acts on — and when several lines are tied, saying
 * so is the difference between one useful order and one useless one.
 */
function BuildabilityBanner({
  buildable,
  limiting,
  blockingCount,
  hasLines,
}: {
  buildable: number
  limiting: string | null
  blockingCount: number
  hasLines: boolean
}) {
  if (!hasLines) {
    return null
  }

  const tone = buildable === 0 ? "danger" : buildable < 5 ? "warning" : "success"

  return (
    <Callout tone={tone}>
      <span>
        <strong className={cn("font-mono text-sm", buildable === 0 && "text-destructive")}>{buildable}</strong>{" "}
        buildable from stock on hand.
        {limiting && (
          <>
            {" "}
            Limited by <strong>{limiting}</strong>
            {blockingCount > 1 && (
              <>
                {" "}
                — and {blockingCount - 1} other line{blockingCount > 2 ? "s" : ""} sit at the same ceiling,
                so fixing one of them alone raises nothing.
              </>
            )}
            .
          </>
        )}
      </span>
    </Callout>
  )
}
