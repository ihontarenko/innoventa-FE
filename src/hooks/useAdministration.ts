import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  adminApi,
  adminRolesApi,
  impersonationApi,
  type AccountKind,
  type AdminUser,
  type ImpersonationSessionResponse,
  type PermissionEffect,
  type RoleView,
  type UserPermissionsView,
} from "@/api/admin"
import { useImpersonationStore } from "@/stores/impersonationStore"
import type { Page } from "@/api/forms"

/**
 * Accounts, roles and the permission catalogue.
 *
 * ⚠️ **Every write invalidates the whole `admin` prefix.** Roles, permissions and accounts are three
 * readings of one authorization state: renaming a role changes what an account's row says it holds, and
 * a screen that refreshed only what it wrote would show the new role beside the old membership.
 */
const ADMIN_KEY = ["admin"] as const

export function useAdminUsers(search?: string, page = 0, size = 25, kind?: AccountKind) {
  return useQuery<Page<AdminUser>>({
    queryKey: ["admin", "users", search ?? "", page, size, kind ?? "all"],
    queryFn: () => adminApi.listUsers(search, page, size, kind).then((response) => response.data),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}

export function useAdminPermissions() {
  return useQuery<string[]>({
    queryKey: ["admin", "permissions"],
    queryFn: () => adminApi.listPermissions().then((response) => response.data),
    // A permission is a constant in the application; the catalogue changes with a deployment.
    staleTime: 60_000,
  })
}

export function useAdminRoles() {
  return useQuery<string[]>({
    queryKey: ["admin", "role-names"],
    queryFn: () => adminApi.listRoles().then((response) => response.data),
    staleTime: 60_000,
  })
}

export function useAdminRolesDetailed() {
  return useQuery<RoleView[]>({
    queryKey: ["admin", "roles"],
    queryFn: () => adminRolesApi.list().then((response) => response.data),
  })
}

function useAdminMutation<Variables, Result>(send: (variables: Variables) => Promise<Result>) {
  const queryClient = useQueryClient()

  return useMutation<Result, unknown, Variables>({
    mutationFn: send,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  })
}

export function useAdminCreateUser() {
  return useAdminMutation((payload: { email: string; password: string; displayName?: string; roles?: string[] }) =>
    adminApi.createUser(payload).then((response) => response.data),
  )
}

export function useAdminUpdateUser() {
  return useAdminMutation(
    ({ userId, ...payload }: { userId: string; displayName?: string; enabled?: boolean; roles?: string[] }) =>
      adminApi.updateUser(userId, payload).then((response) => response.data),
  )
}

export function useAdminResetPassword() {
  return useAdminMutation(({ userId, newPassword }: { userId: string; newPassword: string }) =>
    adminApi.resetPassword(userId, newPassword).then(() => undefined),
  )
}

export function useAdminDeleteUser() {
  return useAdminMutation((userId: string) => adminApi.deleteUser(userId).then(() => undefined))
}

export function useAdminDrawAvatar() {
  return useAdminMutation((userId: string) => adminApi.drawAvatar(userId).then((response) => response.data))
}

export function useAdminUploadAvatar() {
  return useAdminMutation(({ userId, file }: { userId: string; file: File }) =>
    adminApi.uploadAvatar(userId, file).then((response) => response.data),
  )
}

export function useAdminCreateRole() {
  return useAdminMutation((payload: { roleName: string; permissions?: string[] }) =>
    adminRolesApi.create(payload).then((response) => response.data),
  )
}

export function useAdminUpdateRole() {
  return useAdminMutation(({ roleName, permissions }: { roleName: string; permissions: string[] }) =>
    adminRolesApi.update(roleName, permissions).then((response) => response.data),
  )
}

export function useAdminDeleteRole() {
  return useAdminMutation((roleName: string) => adminRolesApi.delete(roleName).then(() => undefined))
}

/**
 * What one account holds, and where each part of it came from.
 *
 * ⚠️ Its own key rather than a slice of the user list: this is the expensive read — it resolves an
 * effective set — and it is asked only when somebody opens the tab that shows it.
 */
export function useAdminUserPermissions(userId: string) {
  return useQuery<UserPermissionsView>({
    queryKey: ["admin", "user-permissions", userId],
    queryFn: () => adminApi.getUserPermissions(userId).then((response) => response.data),
  })
}

/**
 * ⚠️ **Seeded from the response rather than invalidated.** Every one of these answers with the whole
 * effective set, and a refetch would blank the list somebody is pressing buttons in.
 */
function useUserPermissionMutation<Variables>(send: (variables: Variables) => Promise<UserPermissionsView>) {
  const queryClient = useQueryClient()

  return useMutation<UserPermissionsView, unknown, Variables & { userId: string }>({
    mutationFn: (variables) => send(variables),
    onSuccess: (view, variables) => {
      queryClient.setQueryData(["admin", "user-permissions", variables.userId], view)
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
    },
  })
}

export function useAdminSetUserPermission() {
  return useUserPermissionMutation(
    ({ userId, permission, effect }: { userId: string; permission: string; effect: PermissionEffect }) =>
      adminApi.setUserPermission(userId, permission, effect).then((response) => response.data),
  )
}

export function useAdminRemoveUserPermission() {
  return useUserPermissionMutation(({ userId, permission }: { userId: string; permission: string }) =>
    adminApi.removeUserPermission(userId, permission).then((response) => response.data),
  )
}

/**
 * Entering a user's account.
 *
 * ⚠️ **The whole cache is cleared and the page reloaded on both entering and leaving.** Nothing that was
 * fetched under one identity is true under the other — not the workspace list, not the entries, not the
 * profile — and a reload is the only version of "start again as somebody else" with no chance of a stale
 * page being read as the borrowed user's.
 */
export function useBeginImpersonation() {
  const queryClient = useQueryClient()
  const begin = useImpersonationStore((state) => state.begin)

  return useMutation<ImpersonationSessionResponse, unknown, string>({
    mutationFn: (userId) => impersonationApi.begin(userId).then((response) => response.data),
    onSuccess: (session) => {
      begin({
        accessToken: session.accessToken,
        targetUserId: session.targetUserId,
        targetName: session.targetName,
        targetEmail: session.targetEmail,
        expiresAt: new Date(Date.now() + session.sessionMinutes * 60_000).toISOString(),
      })

      queryClient.clear()
      window.location.href = "/"
    },
  })
}

/**
 * Leaving.
 *
 * The server call records the end and revokes the borrowed token; it cannot fail in a way worth trapping
 * somebody in a session for, so the local restore happens either way. An administrator who cannot leave
 * because a request failed is a worse outcome than an unrecorded end.
 */
export function useEndImpersonation() {
  const queryClient = useQueryClient()
  const end = useImpersonationStore((state) => state.end)

  return useMutation<boolean>({
    mutationFn: async () => {
      await impersonationApi.end().catch(() => undefined)

      return end()
    },
    onSuccess: (restored) => {
      queryClient.clear()
      window.location.href = restored ? "/" : "/auth/login"
    },
  })
}
