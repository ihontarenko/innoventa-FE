import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Badge, Skeleton, cn } from "@jmouse/ui"
import { projectsApi, type ProjectUsage } from "@/api/projects"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useSpaceStore } from "@/stores/spaceStore"

/**
 * Which projects are waiting for this — asked of a part, or of a box through the part it holds.
 *
 * <h2>⚠️ The other half of "one plane"</h2>
 *
 * From a project you can see what is on the shelf; this is the same edge walked the other way, and it
 * is the question somebody actually asks before giving a drawer's contents away. The backend answers it
 * under `/api/projects` deliberately: the rows are bills of materials, and so is the permission — a
 * reader who cannot open the project list must not learn what is being built from a part's card
 * instead. Which is why a refusal here draws nothing rather than an error.
 *
 * ⚠️ **Finished projects are shown, marked, never filtered out.** "Nobody wants this any more" and "the
 * only project that wanted it shipped last month" are different answers, and the second is the one that
 * changes what somebody does next.
 */
export function WantedByProjectsPane({
  catalogEntryId,
  positionEntryId,
}: {
  catalogEntryId?: string
  positionEntryId?: string
}) {
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)
  const spaceId = useSpaceStore((state) => state.activeSpaceId)
  const subject = catalogEntryId ?? positionEntryId ?? null

  const query = useQuery<ProjectUsage[]>({
    queryKey: ["projects", "usage", spaceId, catalogEntryId ?? null, positionEntryId ?? null],
    queryFn: () =>
      projectsApi.usage({ catalogEntryId, positionEntryId }).then((response) => response.data),
    enabled: Boolean(spaceId && subject),
    // ⚠️ Not retried: the ordinary failure here is "you may not see projects", and retrying a refusal
    // three times before drawing nothing is three requests to reach the same nothing.
    retry: false,
  })

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  const lines = query.data ?? []

  if (lines.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
        No project asks for this. Nothing on a bill of materials names it — which is what makes it safe
        to move, re-label or give away.
      </p>
    )
  }

  return (
    <div className="min-w-0 overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-[10px] tracking-[0.06em] text-muted-foreground uppercase">
            <th className="px-2.5 py-1.5 text-left font-medium">Project</th>
            <th className="px-2.5 py-1.5 text-left font-medium">Line</th>
            <th className="px-2.5 py-1.5 text-right font-medium">Wants</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.materialId} className={cn("border-b last:border-b-0", !line.live && "opacity-60")}>
              <td className="px-2.5 py-1.5">
                <span className="flex items-center gap-1.5">
                  {spaceSlug ? (
                    <Link
                      to={spaceSectionPath(spaceSlug, `projects/${line.projectId}`)}
                      className="font-medium hover:underline"
                    >
                      {line.projectName}
                    </Link>
                  ) : (
                    <span className="font-medium">{line.projectName}</span>
                  )}
                  {/* ⚠️ The stage, and only when it is a finished one. A badge on every row would stop
                      the finished ones standing out, which is the whole reason they are still here. */}
                  {!line.live && (
                    <Badge variant="outline" className="text-[10px]">
                      {line.stage.toLowerCase()}
                    </Badge>
                  )}
                </span>
              </td>

              <td className="max-w-80 truncate px-2.5 py-1.5 text-muted-foreground">
                {line.reference ? `${line.reference} · ` : ""}
                {line.description}
              </td>

              {/* ⚠️ Both numbers, not their product. "Four each, twenty boards" is what somebody reads;
                  a bare eighty hides which half to argue with. */}
              <td className="px-2.5 py-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                {line.quantityPerUnit}
                {line.buildQuantity > 1 && (
                  <span className="text-muted-foreground"> × {line.buildQuantity}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
