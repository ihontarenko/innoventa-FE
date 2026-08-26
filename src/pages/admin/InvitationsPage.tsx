import { useState } from "react"
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
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@jmouse/ui"
import { AccessDenied } from "@/components/AccessDenied"
import { PageHeader } from "@/components/PageHeader"
import { useCreateInvitation, useInvitations, useRevokeInvitation } from "@/hooks/useInvitations"
import { useAuthStore } from "@/stores/authStore"
import { platformItem, requiredPermissionsOf } from "@/navigation"

/** The declaration this screen is reached by — asked, never re-typed. See `AccessRequirement`. */
const INVITATIONS = platformItem("admin-invitations")
import { readableDate } from "@/lib/dates"
import type { InvitationView } from "@/api/admin"

/**
 * The codes that let somebody become an account here.
 *
 * ⚠️ **Gated on `user:read` held over the installation, not on a role.** An invitation is the first half
 * of an account, so it is read and written with the same permission accounts are — which is also what
 * `AdminInvitationController` asks for, and the two must not drift.
 */
export function InvitationsPage() {
  const mayOpen = useAuthStore((state) => state.holds)

  const { data: invitations = [], isLoading } = useInvitations()
  const revokeInvitation = useRevokeInvitation()

  const [isCreating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  if (!mayOpen(INVITATIONS)) {
    return (
      <AccessDenied
        title="Invitations"
        why="An invitation code is the first half of an account in this installation, so it is read with the same permission accounts are."
        permissions={requiredPermissionsOf(INVITATIONS)}
      />
    )
  }

  async function copyCode(invitation: InvitationView) {
    await navigator.clipboard.writeText(invitation.inviteCode)
    setCopied(invitation.id)
    window.setTimeout(() => setCopied(null), 2000)
  }

  return (
    <>
      <PageHeader
        title="Invitations"
        description="Codes that let somebody become an account here"
        actions={<Button onClick={() => setCreating(true)}>New invitation</Button>}
      />

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="flex flex-col gap-4">
          <Tallies invitations={invitations} />

          {invitations.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
              <span aria-hidden="true" className="text-2xl">
                ✉
              </span>
              <span className="text-sm font-medium">No invitations yet</span>
              <span className="max-w-md text-xs text-muted-foreground">
                Create a code to share with somebody who should have an account here.
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Email hint</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-32">Expires</TableHead>
                    <TableHead className="w-32">Created</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                            {invitation.inviteCode}
                          </code>
                          <Button variant="ghost" size="sm" title="Copy code" onClick={() => copyCode(invitation)}>
                            {copied === invitation.id ? "✓" : "Copy"}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{invitation.email ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{invitation.note ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge invitation={invitation} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{orDash(invitation.expiresAt)}</TableCell>
                      <TableCell className="font-mono text-xs">{orDash(invitation.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        {/* ⚠️ A used code is not revocable, and the button is absent rather than
                            disabled: the account it made already exists, and taking the code back
                            would not take that away. */}
                        {!invitation.used &&
                          (revoking === invitation.id ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={revokeInvitation.isPending}
                              onClick={() =>
                                revokeInvitation.mutate(invitation.id, {
                                  onSuccess: () => {
                                    toast.success(`${invitation.inviteCode} revoked.`)
                                    setRevoking(null)
                                  },
                                })
                              }
                            >
                              Really revoke
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => setRevoking(invitation.id)}>
                              Revoke
                            </Button>
                          ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {isCreating && <CreateInvitationDialog onClose={() => setCreating(false)} />}
    </>
  )
}

/** How many there are, and how many of them still work. */
function Tallies({ invitations }: { invitations: InvitationView[] }) {
  const tallies = [
    { label: "Total", value: invitations.length, tone: "" },
    { label: "Valid", value: invitations.filter((invitation) => invitation.valid).length, tone: "text-success" },
    { label: "Used", value: invitations.filter((invitation) => invitation.used).length, tone: "text-muted-foreground" },
    {
      label: "Expired",
      value: invitations.filter((invitation) => invitation.expired).length,
      tone: "text-destructive",
    },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {tallies.map((tally) => (
        <div key={tally.label} className="flex min-w-24 flex-col rounded-md border px-3 py-2">
          <span className={`font-display text-xl font-semibold ${tally.tone}`}>{tally.value}</span>
          <span className="text-[11px] text-muted-foreground uppercase">{tally.label}</span>
        </div>
      ))}
    </div>
  )
}

function StatusBadge({ invitation }: { invitation: InvitationView }) {
  if (invitation.used) {
    return <Badge variant="secondary">Used</Badge>
  }

  if (invitation.expired) {
    return <Badge variant="destructive">Expired</Badge>
  }

  return <Badge>Valid</Badge>
}

function orDash(value: string | null): string {
  return value ? readableDate(value) : "—"
}

function CreateInvitationDialog({ onClose }: { onClose: () => void }) {
  const createInvitation = useCreateInvitation()

  const [email, setEmail] = useState("")
  const [note, setNote] = useState("")
  const [expiresInDays, setExpiresInDays] = useState("7")

  function create() {
    createInvitation.mutate(
      {
        email: email || undefined,
        note: note || undefined,
        expiresInDays: expiresInDays ? Number.parseInt(expiresInDays, 10) : undefined,
      },
      {
        onSuccess: (invitation) => {
          toast.success(`Invitation ${invitation.inviteCode} created.`)
          onClose()
        },
        onError: (error) => {
          const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail

          toast.error(detail ?? "Failed to create the invitation.")
        },
      },
    )
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New invitation</DialogTitle>
          <DialogDescription>
            {/* ⚠️ The email is a hint and not a restriction — the backend does not bind the code to it.
                Saying so here is what stops somebody treating it as a lock it never was. */}
            The code works whoever redeems it. The email and the note are for whoever reads this list later.
          </DialogDescription>
        </DialogHeader>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">
            For email <span className="text-muted-foreground">(optional hint)</span>
          </span>
          <Input
            className="h-8 text-sm"
            type="email"
            value={email}
            placeholder="user@example.com"
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">
            Note <span className="text-muted-foreground">(optional)</span>
          </span>
          <Input
            className="h-8 text-sm"
            value={note}
            placeholder="Who is this for?"
            onChange={(event) => setNote(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Expires in (days)</span>
          <Input
            className="h-8 text-sm"
            type="number"
            min={1}
            max={365}
            value={expiresInDays}
            placeholder="7"
            onChange={(event) => setExpiresInDays(event.target.value)}
          />
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={createInvitation.isPending} onClick={create}>
            {createInvitation.isPending ? "Creating…" : "Create invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
