import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@jmouse/ui"
import { useDeleteSpace, useLeaveSpace } from "@/hooks/useSpaceSettings"
import { Section, type SpaceSettingsContext } from "./SpaceSettingsSection"

/**
 * The way out — deleting the workspace if it is yours, leaving it if it is not.
 *
 * ⚠️ **Full-height, not a small variant.** It was a third shorter than the *Save changes* two tabs over,
 * which made the one irreversible action on this screen the smallest control on it. Buttons on one screen
 * agree about their size or the reader reads size as meaning, and here it meant the opposite of the truth.
 */
export function DangerZoneSection({ space, isOwner }: SpaceSettingsContext) {
  const navigate = useNavigate()

  const deleteSpace = useDeleteSpace()
  const leaveSpace = useLeaveSpace()

  const [confirming, setConfirming] = useState(false)

  function report(error: unknown, fallback: string) {
    const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail

    toast.error(detail ?? fallback)
  }

  return (
    <Section
      title={isOwner ? "Delete this workspace" : "Leave this workspace"}
      hint={
        isOwner
          ? "Everything in it goes with it, and it cannot be undone"
          : "You keep your account; you simply stop being a member"
      }
    >
      <div>
        {confirming ? (
          <Button
            variant="destructive"
            disabled={deleteSpace.isPending || leaveSpace.isPending}
            onClick={() =>
              isOwner
                ? deleteSpace.mutate(space.id, {
                    onSuccess: () => navigate("/hub"),
                    onError: (error) => report(error, "Failed to delete this workspace."),
                  })
                : leaveSpace.mutate(space.id, {
                    onSuccess: () => navigate("/hub"),
                    onError: (error) => report(error, "Failed to leave this workspace."),
                  })
            }
          >
            {isOwner ? `Really delete “${space.name}” — this cannot be undone` : `Really leave “${space.name}”`}
          </Button>
        ) : (
          <Button variant="outline" className="text-destructive" onClick={() => setConfirming(true)}>
            {isOwner ? "Delete this workspace" : "Leave this workspace"}
          </Button>
        )}
      </div>
    </Section>
  )
}
