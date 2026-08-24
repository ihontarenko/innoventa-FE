import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { invitationsApi, type InvitationView } from "@/api/admin"

/**
 * Invitation codes.
 *
 * ⚠️ **Read and written with `user:*`, not with a permission of their own.** An invitation is the first
 * half of an account: whoever may list accounts may list what will become one, and a separate permission
 * would be a second answer to the same question, drifting from the first at the next change.
 */
const INVITATION_KEY = ["admin", "invitations"] as const

export function useInvitations() {
  return useQuery<InvitationView[]>({
    queryKey: INVITATION_KEY,
    queryFn: () => invitationsApi.list().then((response) => response.data),
  })
}

export function useCreateInvitation() {
  const queryClient = useQueryClient()

  return useMutation<InvitationView, unknown, { email?: string; note?: string; expiresInDays?: number }>({
    mutationFn: ({ email, note, expiresInDays }) =>
      invitationsApi.create(email ?? null, note ?? null, expiresInDays ?? null).then((response) => response.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVITATION_KEY }),
  })
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient()

  return useMutation<void, unknown, string>({
    mutationFn: (invitationId) => invitationsApi.revoke(invitationId).then(() => undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVITATION_KEY }),
  })
}
