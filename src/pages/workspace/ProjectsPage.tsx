import { useMemo, useRef, useState, type ComponentProps } from "react"
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
  Input,
  Textarea,
  useKeyboardShortcuts,
  useListKeyboard,
} from "@jmouse/ui"
import { CardGroup, PageCard } from "@/components/PageCard"
import { ListScreen } from "@/components/layout/ListScreen"
import { CardDensityToggle } from "@/components/CardDensityToggle"
import { groupHues } from "@/lib/groupHues"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { EditorField } from "@/components/form/builder/EditorSection"
import { useCreateProject, useDeleteProject, useProjects } from "@/hooks/useProjects"
import { describeQueryFailure } from "@/lib/loadFailure"
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

  const projectsQuery = useProjects(page, PAGE_SIZE)
  const { data, isLoading, refetch } = projectsQuery
  const failure = describeQueryFailure(projectsQuery, "projects")
  const deleteProject = useDeleteProject()

  const projects = useMemo(() => data?.content ?? [], [data])

  const searchBox = useRef<HTMLInputElement>(null)

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

  /**
   * ⚠️ **Keyed over the cards in the order they are DRAWN, not over `visible`.** The cards are grouped
   * by stage, so the order on screen is the concatenation of the groups; navigating `visible` would
   * make `j` jump between stages in a sequence that matches nothing anybody can see.
   */
  const ordered = useMemo(() => groups.flatMap((group) => group.projects), [groups])

  const keyboard = useListKeyboard<ProjectSummary>({
    rows: ordered,
    identify: (project) => project.id,
    onOpen: (project) => spaceSlug && navigate(spaceSectionPath(spaceSlug, `projects/${project.id}`)),
  })

  useKeyboardShortcuts([
    { keys: "/", describes: "Search projects", group: "This list", run: () => searchBox.current?.focus() },
    { keys: "n", describes: "New project", group: "This list", run: () => setCreating(true) },
    { keys: "j", describes: "Next project", group: "This list", run: () => keyboard.move(1) },
    { keys: "k", describes: "Previous project", group: "This list", run: () => keyboard.move(-1) },
  ])

  return (
    <>
      {/* ⚠️ **Cards here, a table elsewhere, and the shell is the same either way.** A project is one
          independent object with a coverage figure of its own, which is exactly the case the design
          rules keep a card for. What the shell fixes is everything AROUND the rows — where the search
          is, where the stage rail lives, which of the four states shows first. */}
      <ListScreen
        title="Projects"
        description={`${data?.totalElements ?? 0} being built — and what the shelf covers`}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search this page… ( / )",
          inputRef: searchBox,
        }}
        extraActions={<CardDensityToggle />}
        action={{ label: "New project", onClick: () => setCreating(true) }}
        rail={{
          title: "Stage",
          items: filterItems,
          activeKey: activeStatus,
          onSelect: setActiveStatus,
          allLabel: "Every stage",
          allIcon: "☰",
          allCount: projects.length,
        }}
        /* ⚠️ The failure is this product's own `LoadFailure`, not `PageState`'s error kind — it tells
            offline, broken, refused and missing apart, and catches the paused query that stays
            `pending` with no error and would otherwise read as a skeleton that never stops. */
        failure={failure}
        onRetry={() => void refetch()}
        loading={isLoading}
        loadingRows={6}
        isEmpty={visible.length === 0}
        empty={{
          title: projects.length === 0 ? "Nothing being built" : "Nothing matches",
          text: "A project is a bill of materials against what you actually hold — it says how many you could build today, and which line stops you building more.",
          actions:
            projects.length === 0
              ? [{ label: "New project", primary: true, onClick: () => setCreating(true) }]
              : [],
        }}
        pagination={
          data
            ? {
                page,
                totalPages: data.totalPages,
                totalElements: data.totalElements,
                size: data.size,
                onChange: setPage,
              }
            : undefined
        }
      >
        {/* ⚠️ Cards carry their own padding here because the content block has none — a table fills it
            edge to edge, and a card pressed against the same edge would read as a broken table. */}
        <div className="flex flex-col gap-5 p-4">
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
                  keyboardProperties={keyboard.rowProperties(project)}
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
        </div>
      </ListScreen>

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
  keyboardProperties,
  onOpen,
  onDelete,
}: {
  project: ProjectSummary
  keyboardProperties?: ComponentProps<typeof PageCard>["navigation"]
  onOpen: () => void
  onDelete: () => void
}) {
  const total = project.totalMaterialCount

  return (
    <PageCard
      navigation={keyboardProperties}
      icon={GLYPHS[project.status]}
      panelCount={total > 0 ? `${project.coveredMaterialCount}/${total}` : "no BOM"}
      name={project.name}
      isDraft={project.status === "ARCHIVED"}
      badge={<Badge variant="outline">{relativeTime(project.updatedAt)}</Badge>}
      description={project.description}
      chips={
        total > 0 ? (
          <>
            {/* ⚠️ **The run size, because every other figure on this card is read against it.** "Three
                short" is a footnote on a prototype and a stop on a batch of twenty, and a card that
                never said which one this was left the reader to guess. */}
            {project.buildQuantity > 1 && (
              <Badge variant="outline" className="font-mono">
                ×{project.buildQuantity}
              </Badge>
            )}

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
            {/* ⚠️ **"Ready" is a claim about the RUN, not about the lines.** The counters behind it are
                already computed against the build quantity, so a project whose every line is covered can
                be built as planned — which is the sentence somebody opens this list for, and the one a
                bare "fully covered" never quite said. */}
            {project.shortageMaterialCount === 0 && project.unsourcedMaterialCount === 0 && (
              <Badge variant="secondary">
                {project.buildQuantity > 1 ? `ready for ${project.buildQuantity}` : "ready to build"}
              </Badge>
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
  const [buildQuantity, setBuildQuantity] = useState("1")

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

        {/* ⚠️ **Asked at creation because it changes what every line means.** A bill of materials states
            quantities per unit; the run size multiplies them, so a project made without one silently
            reads as a prototype — which is the right default and the wrong assumption to leave unstated.
            It is changed on the project's own screen afterwards. */}
        <EditorField label="Building" hint="How many finished units. Every line's requirement is per unit.">
          <Input
            type="number"
            min={1}
            className="h-8 w-24 text-center font-mono text-sm"
            value={buildQuantity}
            onChange={(event) => setBuildQuantity(event.target.value)}
          />
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
                  buildQuantity: Math.max(1, Number.parseInt(buildQuantity, 10) || 1),
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