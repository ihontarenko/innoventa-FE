import { ProjectFilesPanel } from "@/components/project/ProjectFilesPanel"
import { useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Badge, Button, Input, Skeleton, cn } from "@jmouse/ui"
import { Callout } from "@/components/Callout"
import { PageHeader } from "@/components/PageHeader"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { MaterialRow } from "@/components/project/MaterialRow"
import { ChoosePartDialog } from "@/components/project/ChoosePartDialog"
import { IssueCoveredDialog } from "@/components/project/IssueCoveredDialog"
import {
  useAddMaterial,
  useImportBom,
  useProject,
  useUpdateProject,
} from "@/hooks/useProjects"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useSpaceStore } from "@/stores/spaceStore"
import { PROJECT_STATUSES } from "@/pages/workspace/ProjectsPage"
import type { MaterialCoverageStatus, ProjectMaterial } from "@/api/projects"
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

  /** The line whose part is being chosen, and whether the issue preview is open. */
  const [choosingPartFor, setChoosingPartFor] = useState<ProjectMaterial | null>(null)
  const [isIssuing, setIssuing] = useState(false)
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
  const blocking = new Set(buildability.limitingMaterialIds)

  /**
   * The lines somebody has to do something about.
   *
   * ⚠️ **Short and unidentified together, because both stop the build and neither is fixed by the
   * other.** A part nobody has named cannot be counted at all; a part that is short can. They read as
   * one list because the question — *what do I have to sort out* — is one question.
   */
  const missing = project.materials.filter(
    (material) => material.coverageStatus === "SHORTAGE" || material.coverageStatus === "UNSOURCED",
  )
  const excluded = project.materials.filter((material) => material.excluded).length

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

            {/* ⚠️ **The run size, and it belongs beside the stage rather than in a settings pane.** A
                bill of materials states quantities per unit; this is what multiplies every one of them,
                so it is the difference between "four resistors" and "eighty". Kept here because it is
                changed as often as the stage and read every time the coverage is. */}
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Building
              <Input
                type="number"
                min={1}
                size="sm"
                className="w-16 text-center font-mono"
                defaultValue={project.buildQuantity}
                onBlur={(event) => {
                  const wanted = Math.max(1, Number.parseInt(event.target.value, 10) || 1)

                  if (wanted === project.buildQuantity) {
                    return
                  }

                  updateProject.mutate(
                    { projectId: project.id, buildQuantity: wanted },
                    { onError: () => toast.error("The build quantity was not changed.") },
                  )
                }}
              />
            </label>

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

            {/* ⚠️ **The one irreversible act on this screen, so it is a button that opens a preview and
                never one that does it.** Offered only when something is actually ready — a control that
                refuses when pressed teaches people to stop pressing it. */}
            <Button
              size="sm"
              disabled={project.coveredMaterialCount === 0}
              title={
                project.coveredMaterialCount === 0
                  ? "No line is fully covered yet"
                  : "Take the covered lines off the shelf"
              }
              onClick={() => setIssuing(true)}
            >
              Issue covered
            </Button>
          </>
        }
      />

      <div className="flex min-w-0 flex-col gap-4">
        <BuildabilityBanner
          buildable={buildability.buildableQuantity}
          wanted={project.buildQuantity}
          limiting={buildability.limitingMaterialLabel}
          alsoLimitingCount={buildability.alsoLimitingCount}
          hasLines={project.totalMaterialCount > 0}
        />

        {/* ⚠️ **Five figures on one line, and the excluded one is among them.** A do-not-fit line is not
            covered, not short and not unsourced — without a place of its own it simply vanishes from
            the arithmetic, and the four counters then fail to add up to the number of rows on screen. */}
        {project.totalMaterialCount > 0 && (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-md border bg-card/50 px-3 py-1.5 text-xs">
            <Tally value={project.totalMaterialCount} label="lines" />
            <Tally value={project.coveredMaterialCount} label="covered" tone="text-emerald-600 dark:text-emerald-400" />
            <Tally value={project.shortageMaterialCount} label="short" tone="text-destructive" />
            <Tally value={project.unsourcedMaterialCount} label="unidentified" tone="text-amber-600 dark:text-amber-400" />
            {excluded > 0 && <Tally value={excluded} label="not fitted" tone="text-muted-foreground" />}
          </div>
        )}

        {/* ⚠️ **What is missing, above the bill of materials rather than in a tab.** It is the reason
            somebody opened the screen, and a tab is a place a reader has to already suspect something
            is wrong to visit. It disappears entirely when nothing is missing, which is the whole
            message. */}
        <ProjectFilesPanel projectId={project.id} />

        {missing.length > 0 && (
          <details className="rounded-md border" open={missing.length <= 5}>
            <summary className="cursor-pointer px-3 py-1.5 text-xs font-medium">
              What is missing
              <span className="ml-1.5 text-muted-foreground tabular-nums">{missing.length}</span>
            </summary>

            <div className="min-w-0 overflow-x-auto border-t">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-[10px] tracking-[0.06em] text-muted-foreground uppercase">
                    <th className="px-2.5 py-1.5 text-left font-medium">Line</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Needs</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Free</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Short</th>
                  </tr>
                </thead>
                <tbody>
                  {missing.map((material) => (
                    <tr key={material.id} className="border-b last:border-b-0">
                      <td className="max-w-96 truncate px-2.5 py-1.5">
                        {material.referenceDesignator ? `${material.referenceDesignator} · ` : ""}
                        {material.catalogPartNumberCached ?? material.componentDescription}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono tabular-nums">{material.need}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                        {material.free}
                      </td>
                      {/* ⚠️ An unidentified line is short of everything it wants, and the backend cannot
                          say so — it does not know what the component is, so it has nothing to count. */}
                      <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-destructive">
                        {material.coverageStatus === "UNSOURCED" ? material.need : material.shortage}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

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
                onChoosePart={setChoosingPartFor}
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

      {choosingPartFor && (
        <ChoosePartDialog
          projectId={project.id}
          material={choosingPartFor}
          onClose={() => setChoosingPartFor(null)}
        />
      )}

      {isIssuing && (
        <IssueCoveredDialog
          project={project}
          onClose={() => setIssuing(false)}
          /* ⚠️ Nowhere yet — the movement journal is `INVT-0313`. Until it exists the toast is the whole
             receipt, and sending somebody to a screen that does not exist would be worse than not. */
          onIssued={() => undefined}
        />
      )}
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
  wanted,
  limiting,
  alsoLimitingCount,
  hasLines,
}: {
  buildable: number
  /** How many the run is for — what the answer is read AGAINST. */
  wanted: number
  limiting: string | null
  /** How many lines beyond the first sit at the same ceiling. */
  alsoLimitingCount: number
  hasLines: boolean
}) {
  if (!hasLines) {
    return null
  }

  /**
   * ⚠️ **Judged against the run, never against a number somebody picked.** "Five buildable" is good
   * news for a prototype and a disaster for a batch of twenty, and a banner that went amber at four
   * whatever the plan was would be right by accident.
   */
  const tone = buildable === 0 ? "danger" : buildable < wanted ? "warning" : "success"

  return (
    <Callout tone={tone}>
      <span>
        <strong className={cn("font-mono text-sm", buildable === 0 && "text-destructive")}>{buildable}</strong>{" "}
        {wanted > 1 ? (
          <>
            of {wanted} buildable from what is free right now.
          </>
        ) : (
          <>buildable from what is free right now.</>
        )}
        {limiting && (
          <>
            {" "}
            Limited by <strong>{limiting}</strong>
            {alsoLimitingCount > 0 && (
              <>
                {" "}
                — and {alsoLimitingCount} other line{alsoLimitingCount > 1 ? "s" : ""} sit at the same
                ceiling, so fixing one of them alone raises nothing
              </>
            )}
            .
          </>
        )}
      </span>
    </Callout>
  )
}

/** One figure and what it counts — the row of them above the bill of materials. */
function Tally({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className={cn("font-mono font-medium tabular-nums", tone)}>{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  )
}
