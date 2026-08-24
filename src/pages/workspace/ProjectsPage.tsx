import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  type FilterItem,
  FilterPanel,
  Input,
  Skeleton,
  Textarea,
} from "@jmouse/ui"
import { CardGroup, PageCard } from "@/components/PageCard"
import { PageHeader } from "@/components/PageHeader"
import { CardDensityToggle } from "@/components/CardDensityToggle"
import { groupHues } from "@/lib/groupHues"
import { Pagination } from "@/components/Pagination"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { EditorField } from "@/components/form/builder/EditorSection"
import { useCreateProject, useDeleteProject, useProjects } from "@/hooks/useProjects"
import { relativeTime } from "@/lib/dates"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useSpaceStore } from "@/stores/spaceStore"
import type { ProjectStatus, ProjectSummary } from "@/api/projects"

/**
 * Where a project is in its life.
 *
 * ⚠️ **Ordered as the work runs, not alphabetically.** Somebody scanning this list is asking *how far
 * along is everything*, and an alphabetical order answers a question nobody has.
 */
const STATUSES: Array<{ value: ProjectStatus; glyph: string; label: string }> = [
  { value: "DESIGN", glyph: "✎", label: "Design" },
  { value: "PROTOTYPE", glyph: "⚗", label: "Prototype" },
  { value: "PRODUCTION", glyph: "⚙", label: "Production" },
  { value: "REPAIR", glyph: "🔧", label: "Repair" },
  { value: "COMPLETE", glyph: "✓", label: "Complete" },
  { value: "ARCHIVED", glyph: "▤", label: "Archived" },
]

const GLYPHS = Object.fromEntries(STATUSES.map((status) => [status.value, status.glyph])) as Record<
  ProjectStatus,
  string
>

const PAGE_SIZE = 25

/**
 * The things being built, and how far the shelf gets you.
 *
 * ⚠️ **A project's headline number is coverage, not progress.** *Nine of twelve lines covered* is a fact
 * about the stock room; a percentage complete would be a guess about the work, and the product has no
 * business guessing that.
 */
export function ProjectsPage() {
  const navigate = useNavigate()
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)

  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [activeStatus, setActiveStatus] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const { data, isLoading } = useProjects(page, PAGE_SIZE)
  const deleteProject = useDeleteProject()

  const projects = useMemo(() => data?.content ?? [], [data])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()

    return projects
      .filter((project) => !activeStatus || project.status === activeStatus)
      .filter(
        (project) =>
          needle === "" ||
          project.name.toLowerCase().includes(needle) ||
          (project.description ?? "").toLowerCase().includes(needle),
      )
  }, [projects, activeStatus, search])

  const filterItems: FilterItem[] = STATUSES.map((status) => ({
    key: status.value,
    icon: status.glyph,
    label: status.label,
    count: projects.filter((project) => project.status === status.value).length,
  })).filter((facet) => facet.count > 0)

  // Grouped by status so the run of work reads down the page in the order it happens.
  const groups = useMemo(() => {
    return STATUSES.map((status) => ({
      status,
      projects: visible.filter((project) => project.status === status.value),
    })).filter((group) => group.projects.length > 0)
  }, [visible])

  const hueOfGroup = useMemo(() => groupHues(groups.map((group) => group.status.value)), [groups])

  return (
    <>
      <PageHeader
        title="Projects"
        description={`${data?.totalElements ?? 0} being built — and what the shelf covers`}
        actions={
          <>
            <Input
              className="h-8 w-56 text-sm"
              value={search}
              placeholder="Search this page…"
              onChange={(event) => setSearch(event.target.value)}
            />
            <CardDensityToggle />
            <Button size="sm" onClick={() => setCreating(true)}>
              New project
            </Button>
          </>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <FilterPanel
          title="Stage"
          items={filterItems}
          activeKey={activeStatus}
          onSelect={setActiveStatus}
          allLabel="Every stage"
          allIcon="☰"
          allCount={projects.length}
        />

        <div className="flex min-w-0 flex-col gap-5">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
              <span aria-hidden="true" className="text-2xl">
                ⚙
              </span>
              <span className="text-sm font-medium">
                {projects.length === 0 ? "Nothing being built" : "Nothing matches"}
              </span>
              <span className="max-w-md text-xs text-muted-foreground">
                A project is a bill of materials against what you actually hold — it says how many you
                could build today, and which line stops you building more.
              </span>
              {projects.length === 0 && (
                <Button size="sm" className="mt-2" onClick={() => setCreating(true)}>
                  New project
                </Button>
              )}
            </div>
          ) : (
            <>
              {groups.map((group) => (
                <CardGroup
                  key={group.status.value}
                  title={group.status.label}
                  icon={group.status.glyph}
                  count={group.projects.length}
                  hue={hueOfGroup.get(group.status.value)}
                >
                  {group.projects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onOpen={() => spaceSlug && navigate(spaceSectionPath(spaceSlug, `projects/${project.id}`))}
                      onDelete={() =>
                        deleteProject.mutate(project.id, {
                          onSuccess: () => toast.success(`${project.name} deleted.`),
                          onError: () => toast.error("That project was not deleted."),
                        })
                      }
                    />
                  ))}
                </CardGroup>
              ))}

              {data && data.totalPages > 1 && (
                <Pagination
                  page={page}
                  totalPages={data.totalPages}
                  totalElements={data.totalElements}
                  size={data.size}
                  onChange={setPage}
                />
              )}
            </>
          )}
        </div>
      </div>

      {creating && (
        <CreateProjectDialog
          onClose={() => setCreating(false)}
          onCreated={(projectId) => {
            setCreating(false)

            if (spaceSlug) {
              navigate(spaceSectionPath(spaceSlug, `projects/${projectId}`))
            }
          }}
        />
      )}
    </>
  )
}

function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: ProjectSummary
  onOpen: () => void
  onDelete: () => void
}) {
  const total = project.totalMaterialCount

  return (
    <PageCard
      icon={GLYPHS[project.status]}
      panelCount={total > 0 ? `${project.coveredMaterialCount}/${total}` : "no BOM"}
      name={project.name}
      isDraft={project.status === "ARCHIVED"}
      badge={<Badge variant="outline">{relativeTime(project.updatedAt)}</Badge>}
      description={project.description}
      chips={
        total > 0 ? (
          <>
            {/* ⚠️ Only the counts that are non-zero. A row of three chips reading "0 short, 0 unsourced"
                is noise on the project that is fine, which is most of them. */}
            {project.shortageMaterialCount > 0 && (
              <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
                {project.shortageMaterialCount} short
              </Badge>
            )}
            {project.unsourcedMaterialCount > 0 && (
              <Badge variant="outline" className="text-muted-foreground">
                {project.unsourcedMaterialCount} unsourced
              </Badge>
            )}
            {project.shortageMaterialCount === 0 && project.unsourcedMaterialCount === 0 && (
              <Badge variant="secondary">fully covered</Badge>
            )}
          </>
        ) : undefined
      }
      onOpen={onOpen}
      actions={
        <Button variant="outline" size="sm" onClick={onOpen}>
          Open
        </Button>
      }
      onDelete={onDelete}
      confirmMessage={`Delete "${project.name}"?`}
    />
  )
}

function CreateProjectDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (projectId: string) => void
}) {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)
  const createProject = useCreateProject()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<ProjectStatus>("DESIGN")

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex flex-col gap-3 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            A bill of materials read against what you hold. Add lines by hand, or import one from a
            distributor's export.
          </DialogDescription>
        </DialogHeader>

        <EditorField label="Name">
          <Input
            autoFocus
            className="h-8 text-sm"
            value={name}
            placeholder="Bench supply — rev C"
            onChange={(event) => setName(event.target.value)}
          />
        </EditorField>

        <EditorField label="Stage">
          <PlainSelect value={status} onChange={(next) => setStatus(next as ProjectStatus)}>
            {STATUSES.map((one) => (
              <option key={one.value} value={one.value}>
                {one.glyph} {one.label}
              </option>
            ))}
          </PlainSelect>
        </EditorField>

        <EditorField label="Description" hint="What it is, in one line.">
          <Textarea
            rows={2}
            className="text-sm"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </EditorField>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || createProject.isPending}
            onClick={() =>
              createProject.mutate(
                {
                  name: name.trim(),
                  description: description.trim() || undefined,
                  status,
                  spaceId: spaceId ?? undefined,
                },
                {
                  onSuccess: (project) => onCreated(project.id),
                  onError: (error) => {
                    const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail

                    toast.error(detail ?? "That project was not created.")
                  },
                },
              )
            }
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { GLYPHS as PROJECT_GLYPHS, STATUSES as PROJECT_STATUSES }