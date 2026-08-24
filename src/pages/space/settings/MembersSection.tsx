import { useState } from "react"
import { toast } from "sonner"
import { Badge, Button, Input, Row, RowAction, RowList, RowMeta, RowTitle } from "@jmouse/ui"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { useInviteMember, useRemoveMember, useUpdateMemberRole } from "@/hooks/useSpaceSettings"
import type { SpaceMemberRole } from "@/api/spaces"
import { Section, type SpaceSettingsContext } from "./SpaceSettingsSection"

const ASSIGNABLE_ROLES: SpaceMemberRole[] = ["ADMIN", "MEMBER", "VIEWER"]

/** Who is in this workspace, and what each of them may do here. */
export function MembersSection({ space, isAdmin }: SpaceSettingsContext) {
  const inviteMember = useInviteMember()
  const updateMemberRole = useUpdateMemberRole()
  const removeMember = useRemoveMember()

  const [inviting, setInviting] = useState(false)
  const [identifier, setIdentifier] = useState("")
  const [role, setRole] = useState<SpaceMemberRole>("MEMBER")
  const [removingId, setRemovingId] = useState<string | null>(null)

  // The page already holds this workspace from the same query, and a mutation invalidates it — asking
  // again here would be a second subscription to one answer.
  const members = space.members

  function invite() {
    inviteMember.mutate(
      { spaceId: space.id, identifier: identifier.trim(), role },
      {
        onSuccess: () => {
          setIdentifier("")
          setInviting(false)
          toast.success("Invited.")
        },
        onError: (error) => {
          const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail

          toast.error(detail ?? "Failed to invite this person.")
        },
      },
    )
  }

  return (
    <Section title="Members" hint={`${members.length} in this workspace`}>
      {isAdmin && !inviting && (
        <div>
          <Button variant="outline" size="sm" onClick={() => setInviting(true)}>
            Invite somebody
          </Button>
        </div>
      )}

      {inviting && isAdmin && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-3">
          <Input
            autoFocus
            className="h-8 flex-1 text-sm"
            value={identifier}
            placeholder="User ID or email"
            onChange={(event) => setIdentifier(event.target.value)}
          />
          <PlainSelect value={role} className="w-32" onChange={(next) => setRole(next as SpaceMemberRole)}>
            {ASSIGNABLE_ROLES.map((assignable) => (
              <option key={assignable} value={assignable}>
                {assignable}
              </option>
            ))}
          </PlainSelect>
          <Button size="sm" disabled={!identifier.trim() || inviteMember.isPending} onClick={invite}>
            Invite
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setInviting(false)}>
            Cancel
          </Button>
        </div>
      )}

      <RowList>
        {members.map((member) => (
          <Row
            key={member.userId}
            leading={<span aria-hidden="true">☺</span>}
            trailing={
              <>
                {isAdmin && member.role !== "OWNER" ? (
                  <PlainSelect
                    value={member.role}
                    className="w-32"
                    onChange={(next) => updateMemberRole.mutate({ spaceId: space.id, userId: member.userId, role: next })}
                  >
                    {ASSIGNABLE_ROLES.map((assignable) => (
                      <option key={assignable} value={assignable}>
                        {assignable}
                      </option>
                    ))}
                  </PlainSelect>
                ) : (
                  <Badge variant={member.role === "OWNER" || member.role === "ADMIN" ? "default" : "secondary"}>
                    {member.role}
                  </Badge>
                )}

                {/* "Remove" rather than a cross. An icon that only means "destroy" once you already know
                    is not a label, and this one takes somebody's access away. */}
                {isAdmin &&
                  member.role !== "OWNER" &&
                  (removingId === member.userId ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        removeMember.mutate({ spaceId: space.id, userId: member.userId })
                        setRemovingId(null)
                      }}
                    >
                      Really remove
                    </Button>
                  ) : (
                    <RowAction>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => setRemovingId(member.userId)}
                      >
                        Remove
                      </Button>
                    </RowAction>
                  ))}
              </>
            }
          >
            <RowTitle>{member.displayName ?? member.email}</RowTitle>
            {member.displayName && <RowMeta>{member.email}</RowMeta>}
          </Row>
        ))}
      </RowList>
    </Section>
  )
}
