import { useState } from "react"
import { toast } from "sonner"
import { Check, Copy, Link2, Link2Off, RefreshCw, Share2 } from "lucide-react"
import { Badge, Button, Input, Popover, PopoverContent, PopoverTrigger } from "@jmouse/ui"
import { useCopyFeedback } from "@/hooks/useCopyFeedback"
import {
  publicAddressOf,
  useRevokeShare,
  useRotateShare,
  useShareToken,
  type ShareEntityType,
} from "@/hooks/useShareLink"

/**
 * Give one thing a public address, or take it back.
 *
 * ⚠️ **This is the control that did not exist.** The mechanism has been complete on both sides for a
 * long time — `ShareTokenController` mints, rotates and withdraws a link for a file, an entry, a page or
 * a form through one route, and every public page to read them at is built. What was missing was
 * anywhere to *press*: outside the admin Sharing Center, the only two things that could be shared from
 * the interface were a form (through its Reach pane) and a page (through its Sharing tab). A record and
 * a file could be shown as *shared* and never made so, which is why `ENTRY` stood at zero.
 *
 * ⚠️ **Rotate is destructive and has to say so.** One route both creates a link and replaces one, and
 * replacing invalidates whatever was handed out before. A single button labelled *Share* would quietly
 * break every address already in somebody's message; so the two states offer different words, and the
 * replacing one names its consequence.
 *
 * ⚠️ **The address is the branded page, never the raw resource.** A file's public link is `/_/viewer`,
 * not `/_/file` — the second serves bytes and is what an embed points at; handing a person that address
 * drops them into a PDF with no way back. `publicAddressOf` is the one place that mapping lives.
 */
export function ShareControl({
  entityType,
  entityId,
  subject,
  size = "sm",
}: {
  entityType: ShareEntityType
  entityId: string
  /** What is being shared, in words — used in the confirmation and nowhere else. */
  subject: string
  /** ⚠️ The library's own sizes, so this sits level with whatever it stands beside. */
  size?: "sm" | "xs"
}) {
  const { data: token, isLoading } = useShareToken(entityType, entityId)
  const rotate = useRotateShare()
  const revoke = useRevokeShare()
  const { copied, copy } = useCopyFeedback()

  const [isOpen, setOpen] = useState(false)
  const [confirmingRevoke, setConfirmingRevoke] = useState(false)

  const address = token ? publicAddressOf(entityType, token) : null
  const busy = rotate.isPending || revoke.isPending

  return (
    <Popover
      open={isOpen}
      onOpenChange={(next) => {
        setOpen(next)
        /* A confirmation left armed is one somebody triggers by reopening and pressing the same spot. */
        if (!next) {
          setConfirmingRevoke(false)
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant={token ? "secondary" : "outline"} size={size} disabled={isLoading}>
          <Share2 />
          Share
          {token && (
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
              on
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-84 p-3">
        {address ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-1.5">
              <Link2 className="size-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Anyone with this link can read it</span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* ⚠️ `readOnly` rather than `disabled`: a disabled input cannot be selected, and selecting
                  the address by hand is what somebody does when the clipboard is refused. */}
              <Input readOnly size="sm" className="flex-1 font-mono text-[11px]" value={address} />

              <Button
                size="icon-sm"
                variant="outline"
                title="Copy the link"
                aria-label="Copy the link"
                onClick={() => void copy(address).catch(() => toast.error("The clipboard refused that."))}
              >
                {copied ? <Check className="text-success" /> : <Copy />}
              </Button>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={busy}
                onClick={() =>
                  rotate.mutate(
                    { entityType, entityId },
                    {
                      onSuccess: () => toast.success("A new link. The old one stopped working."),
                      onError: () => toast.error("That link was not replaced."),
                    },
                  )
                }
              >
                <RefreshCw />
                Replace
              </Button>

              {confirmingRevoke ? (
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  disabled={busy}
                  onClick={() =>
                    revoke.mutate(
                      { entityType, entityId },
                      {
                        onSuccess: () => {
                          toast.success(`${subject} is no longer shared.`)
                          setConfirmingRevoke(false)
                          setOpen(false)
                        },
                        onError: () => toast.error("Sharing was not switched off."),
                      },
                    )
                  }
                >
                  Really stop
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-destructive hover:bg-destructive/10"
                  disabled={busy}
                  onClick={() => setConfirmingRevoke(true)}
                >
                  <Link2Off />
                  Stop
                </Button>
              )}
            </div>

            {/* ⚠️ Said before the button is pressed, not after. *Replace* is the only way back from a link
                that got out, and it is also the thing that breaks every link already handed out. */}
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Replacing mints a new address and stops the old one working — that is what it is for.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-1.5">
              <Link2Off className="size-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Not shared</span>
            </div>

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              A link gives anyone who has it read access, with no account and no sign-in. Nothing else
              about {subject} changes, and it can be withdrawn at any time.
            </p>

            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                rotate.mutate(
                  { entityType, entityId },
                  {
                    onSuccess: () => toast.success("Shared."),
                    onError: () => toast.error("That was not shared."),
                  },
                )
              }
            >
              <Link2 />
              Create a link
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
