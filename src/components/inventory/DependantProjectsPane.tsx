import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Badge, Skeleton, cn } from "@jmouse/ui"
import { projectsApi, type ProjectDependant } from "@/api/projects"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useSpaceStore } from "@/stores/spaceStore"

/**
 * Whose work would notice if this place changed.
 *
 * <h2>⚠️ The question asked before moving a cabinet, and it had no answer</h2>
 *
 * A place holds positions; a position is of a part; a part is what a bill of materials asks for. Three
 * hops, and the answer is a list of **people's work** rather than of components — which is why the
 * backend groups it by project rather than returning forty rows. Without it, emptying a drawer is a
 * decision taken blind.
 *
 * ⚠️ **It reaches into nested places.** A cabinet somebody is about to move is emptied by moving its
 * drawers, so the projects that would notice are the ones that need what is in any of them.
 *
 * ⚠️ **Gated on seeing projects at all**, so a reader without that gets nothing rather than an error —
 * a person who cannot open the project list must not learn what is being built from a shelf instead.
 */
export function DependantProjectsPane({ locationId }: { locationId: string }) {
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  const query = useQuery<ProjectDependant[]>({
    queryKey: ["projects", "dependants", spaceId, locationId],
    queryFn: () => projectsApi.dependants(locationId, true).then((response) => response.data),
    enabled: Boolean(spaceId && locationId),
    retry: false,
  })

  if (query.isLoading) {
    return <Skeleton className="h-16 w-full" />
  }

  const dependants = query.data ?? []

  if (dependants.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
        No project depends on what is kept here — nothing on a bill of materials asks for any of it.
        That is what makes this place safe to move, re-label or empty.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] text-muted-foreground">
        Before you move this cabinet — here is who would feel it.
      </p>

      {dependants.map((project) => (
        <div key={project.projectId} className={cn("rounded-md border px-2.5 py-1.5", !project.live && "opacity-60")}>
          <span className="flex flex-wrap items-baseline gap-1.5 text-sm">
            {spaceSlug ? (
              <Link
                to={spaceSectionPath(spaceSlug, `projects/${project.projectId}`)}
                className="font-medium hover:underline"
              >
                {project.projectName}
              </Link>
            ) : (
              <span className="font-medium">{project.projectName}</span>
            )}

            {/* ⚠️ Only on a finished one. A badge on every row would stop the finished ones standing
                out, and "the only project that wanted this shipped last month" is the answer that
                changes what somebody does next. */}
            {!project.live && (
              <Badge variant="outline" className="text-[10px]">
                {project.stage.toLowerCase()}
              </Badge>
            )}

            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {project.lineCount} {project.lineCount === 1 ? "line" : "lines"}
            </span>
          </span>

          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {project.lines
              .map((line) => (line.reference ? `${line.reference} · ${line.description}` : line.description))
              .join(" · ")}
          </p>
        </div>
      ))}
    </div>
  )
}
