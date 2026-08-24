import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
  Switch,
  cn,
} from "@jmouse/ui"
import { BOUNDED_DIALOG, DialogBody } from "@/components/BoundedDialog"
import { useLabelShares, useShareLabelTemplate } from "@/hooks/useLabels"
import { useSpaces } from "@/hooks/useSpaces"
import type { LabelTemplateSummary } from "@/types"

/**
 * Which workspaces a design has been put into.
 *
 * ⚠️ **The whole set is sent at once, not one workspace at a time.** "Which workspaces is this in" is
 * one question with one answer; a per-row toggle that saved immediately would make a half-applied state
 * reachable, and there is no sensible thing to show for it.
 *
 * ⚠️ **A design stays OWNED by whoever made it.** Sharing puts it where others can print from it — it
 * does not hand it over. Somebody else's copy comes from Duplicate, and is theirs.
 */
export function ShareLabelDesignDialog({
  template,
  onClose,
}: {
  template: LabelTemplateSummary
  onClose: () => void
}) {
  const { data: spaces = [] } = useSpaces()
  const { data: shared, isLoading } = useLabelShares(template.id)
  const shareTemplate = useShareLabelTemplate()

  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    if (shared) {
      setSelected(shared)
    }
  }, [shared])

  function toggle(spaceId: string) {
    setSelected((current) =>
      current.includes(spaceId) ? current.filter((one) => one !== spaceId) : [...current, spaceId],
    )
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={cn(BOUNDED_DIALOG, "sm:max-w-md")}>
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base">Share “{template.name}”</DialogTitle>
          <DialogDescription className="text-xs">
            People in these workspaces can print from it. It stays yours to change.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="flex flex-col gap-1">
              {spaces.map((space) => (
                <label
                  key={space.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent/50"
                >
                  <Switch checked={selected.includes(space.id)} onCheckedChange={() => toggle(space.id)} />
                  <span className="truncate text-sm">{space.name}</span>
                </label>
              ))}
            </div>
          )}
        </DialogBody>

        <DialogFooter className="shrink-0">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={shareTemplate.isPending}
            onClick={() =>
              shareTemplate.mutate(
                { templateId: template.id, spaceIds: selected },
                {
                  onSuccess: () => {
                    toast.success("Sharing updated.")
                    onClose()
                  },
                  onError: () => toast.error("That was not saved."),
                },
              )
            }
          >
            {shareTemplate.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
