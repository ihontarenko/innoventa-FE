import { useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ImageUp } from "lucide-react"
import { toast } from "sonner"
import { AvatarPickerDialog as SharedAvatarPickerDialog, type AvatarChoice } from "@jmouse/avatars/picker"
import { ImageSquareCropper, type CropperHandle } from "@/components/account/ImageSquareCropper"
import { avatarActions } from "@/api/avatarActions"
import { useProfile } from "@/hooks/useProfile"
import { detailOf } from "@/lib/apiErrors"

/**
 * Choosing a face — the half only Innoventa can do.
 *
 * ⚠️ **The dialog itself lives in `@jmouse/avatars/picker`.** What was here was 248 lines, of which the
 * face grid, the source switch and the chrome were the same as Tessera's and Kiwi's — three copies that
 * had already started to drift. What stayed is everything the shared one cannot know: this product's
 * routes, its error shape, its cache invalidation, and its own cropper.
 *
 * ⚠️ **`BOUNDED_DIALOG` is gone from here and that is not a loss.** The shared dialog bounds itself and
 * scrolls its own body, because the argument that component makes is true of every product showing a
 * strategy strip, a control panel and a grid of thirty-two faces — it was Innoventa's only by accident
 * of who hit the bug first.
 */
export function AvatarPickerDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { data: account } = useProfile()

  const [picture, setPicture] = useState<File | null>(null)

  const cropper = useRef<CropperHandle>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const settled = () => {
    // ⚠️ The current account is cached with `staleTime: Infinity`, so nothing refetches on its own — an
    // avatar changed without this invalidation is a face that only appears after a reload.
    queryClient.invalidateQueries({ queryKey: ["current-member"] })
    // Every listing embeds an account summary, so all of them now carry a stale face.
    queryClient.invalidateQueries()
    setPicture(null)
    onOpenChange(false)
  }

  const failed = (error: unknown) => toast.error(detailOf(error) ?? "That avatar could not be saved.")

  const saveGenerated = useMutation({
    mutationFn: avatarActions.choosePreset,
    onSuccess: () => {
      toast.success("New face on.")
      settled()
    },
    onError: failed,
  })

  const savePicture = useMutation({
    mutationFn: avatarActions.uploadPicture,
    onSuccess: () => {
      toast.success("Picture uploaded.")
      settled()
    },
    onError: failed,
  })

  const dropBackToInitials = useMutation({
    mutationFn: avatarActions.clear,
    onSuccess: () => {
      toast.success("Back to initials.")
      settled()
    },
    onError: failed,
  })

  const saving = saveGenerated.isPending || savePicture.isPending || dropBackToInitials.isPending

  const submit = async (choice: AvatarChoice) => {
    if (choice.kind === "generated") {
      saveGenerated.mutate(choice.token)
      return
    }

    if (choice.kind === "initials") {
      dropBackToInitials.mutate()
      return
    }

    if (!cropper.current) {
      return
    }

    try {
      savePicture.mutate(await cropper.current.toSquarePng())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That picture could not be cropped.")
    }
  }

  return (
    <SharedAvatarPickerDialog
      open={open}
      onOpenChange={onOpenChange}
      value={account?.avatar.kind === "PRESET" ? account.avatar.preset ?? null : null}
      seedHint={account?.displayName ?? account?.email ?? undefined}
      pictureReady={picture !== null}
      saving={saving}
      onSubmit={submit}
      pictureSource={
        <div className="space-y-3">
          {picture ? (
            <ImageSquareCropper ref={cropper} file={picture} onDiscard={() => setPicture(null)} />
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex h-56 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              <ImageUp className="size-6" />
              Choose a picture
              <span className="text-xs">PNG, JPEG, WebP or GIF</span>
            </button>
          )}

          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(event) => {
              const chosen = event.target.files?.[0]
              setPicture(chosen ?? null)
              // Cleared so choosing the SAME file after discarding it fires a change event again.
              event.target.value = ""
            }}
          />
        </div>
      }
    />
  )
}
