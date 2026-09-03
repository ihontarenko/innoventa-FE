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
} from "@jmouse/ui"
import { useIssueCoveredLines } from "@/hooks/useProjects"
import type { ProjectDetail } from "@/api/projects"

/**
 * Taking a project's components off the shelf — shown before it happens.
 *
 * <h2>⚠️ A preview, because this is the one irreversible thing on the screen</h2>
 *
 * Everything else about a bill of materials is arithmetic over numbers nobody has touched. This empties
 * boxes, and undoing it means a stocktake. So the dialog states, line by line, what will be taken and
 * what will be left — and names the lines that will be skipped, because "twelve issued" on its own
 * reads as done when three lines are still short.
 *
 * ⚠️ **What is shown is what the server will decide, not a second opinion.** The figures come from the
 * project's own coverage — the same `need` and `free` the rows above show — so the preview cannot drift
 * from the action. Where the shelf moves between the two, the backend refuses the whole issue and says
 * so rather than handing over a partial kit.
 */
export function IssueCoveredDialog({
  project,
  onClose,
  onIssued,
}: {
  project: ProjectDetail
  onClose: () => void
  /** Where to go once it is done — the history, so somebody can see what left. */
  onIssued: () => void
}) {
  const issue = useIssueCoveredLines()

  const covered = project.materials.filter((material) => material.coverageStatus === "COVERED")
  const short = project.materials.filter(
    (material) => material.coverageStatus === "SHORTAGE" || material.coverageStatus === "UNSOURCED",
  )

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Take the covered lines off the shelf</DialogTitle>
          <DialogDescription>
            {project.buildQuantity > 1
              ? `Enough for ${project.buildQuantity} units of ${project.name}. `
              : ""}
            Each line is recorded as an issue against this project, so the journal can always say where
            the components went. The project's claim on each part is released as it is taken.
          </DialogDescription>
        </DialogHeader>

        {covered.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
            Nothing is ready to be taken — no line is fully covered. Receive what is missing, or lower the
            build quantity.
          </p>
        ) : (
          <div className="min-w-0 overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-[10px] tracking-[0.06em] text-muted-foreground uppercase">
                  <th className="px-2.5 py-1.5 text-left font-medium">Line</th>
                  <th className="px-2.5 py-1.5 text-left font-medium">From</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Take</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Left</th>
                </tr>
              </thead>
              <tbody>
                {covered.map((material) => (
                  <tr key={material.id} className="border-b last:border-b-0">
                    <td className="max-w-72 truncate px-2.5 py-1.5">
                      {material.referenceDesignator ? `${material.referenceDesignator} · ` : ""}
                      {material.catalogPartNumberCached ?? material.componentDescription}
                    </td>

                    {/* ⚠️ The places, because the fullest box is drawn down first and somebody is about
                        to walk to them. A count alone would send them to look. */}
                    <td className="max-w-72 truncate px-2.5 py-1.5 text-muted-foreground">
                      {material.positions.length === 0
                        ? "—"
                        : material.positions
                            .map((position) => position.locationPath ?? "somewhere")
                            .join(" · ")}
                    </td>

                    <td className="px-2.5 py-1.5 text-right font-mono tabular-nums">{material.need}</td>
                    <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                      {material.free - material.need}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ⚠️ Said here rather than discovered afterwards. "Twelve issued" reads as finished; "twelve
            issued, three still short" is the sentence somebody can act on. */}
        {short.length > 0 && (
          <p className="text-xs text-muted-foreground">
            <Badge variant="outline" className="mr-1.5">
              {short.length}
            </Badge>
            {short.length === 1 ? "line is" : "lines are"} left alone — not fully covered.
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={covered.length === 0 || issue.isPending}
            onClick={() =>
              issue.mutate(project.id, {
                onSuccess: (result) => {
                  toast.success(
                    result.skippedLineCount > 0
                      ? `${result.issuedLineCount} issued, ${result.skippedLineCount} left short.`
                      : `${result.issuedLineCount} issued.`,
                  )
                  onClose()
                  onIssued()
                },
                onError: (error) => {
                  const detail = (error as { response?: { data?: { detail?: string } } }).response?.data
                    ?.detail

                  // ⚠️ The backend's own sentence. It knows whether the shelf moved underneath, and
                  // that refusal names what could not be found — nothing was taken.
                  toast.error(detail ?? "Nothing was issued.")
                },
              })
            }
          >
            Issue {covered.length} {covered.length === 1 ? "line" : "lines"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
