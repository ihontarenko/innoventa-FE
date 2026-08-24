import type { AvatarView } from "@/api/avatars"
import { http } from "./http"
import type { Page } from "./forms"

/** Whether an account row is a person or a client. */
export type AccountKind = "PERSON" | "AGENT"

/** An account as the administration screens list it. */
export interface AdminUser {
  id: string
  email: string
  displayName: string | null
  provider: string
  /** What this account's face is — a shape rather than a URL since INVT-0064. See `@/api/avatars`. */
  avatar: AvatarView
  roles: string[]
  twoFactorEnabled: boolean
  enabled: boolean
  failedLoginCount: number
  lastLoginAt: string | null
  createdAt: string | null
  /**
   * Whether this row is a person or a client.
   *
   * ⚠️ **An offer to the interface, never a claim about authority.** What a client may do is what the
   * person who approved it may do, and that is decided from the request rather than from this row.
   */
  kind: AccountKind
  /** Whose client this is, and null on a person. For rendering only. */
  ownerId: string | null
  /** That owner's name as it reads today, so a row can say whose client it is. */
  ownerName: string | null
  /** When the client was switched off, or null while it is live. Never a reason to delete it. */
  retiredAt: string | null
}

/** Whether an account row is a client rather than a person. */
export function isClientAccount(account: Pick<AdminUser, "kind">): boolean {
  return account.kind === "AGENT"
}

export type PermissionEffect = "ALLOW" | "DENY"

export interface UserPermissionGrant {
  permissionName: string
  effect: PermissionEffect
}

export interface UserPermissionsView {
  rolePermissions: string[]
  grants: UserPermissionGrant[]
  effective: string[]
}

/**
 * A role and what it carries.
 *
 * @property declaredInPolicy ⚠️ whether a policy document owns this bundle. When it does,
 *           `permissions` is the file's and this screen may not edit it — the server refuses, and
 *           naming the file is the only useful answer.
 */
export interface RoleView {
  roleName: string
  /** The widest place this role may be handed out at. */
  assignableAt: string
  /** Permission names. There are no permission rows, so there is nothing else to carry. */
  permissions: string[]
  declaredInPolicy: boolean
}

export const adminApi = {
  /**
   * @param kind `PERSON`, `AGENT`, or omitted for every account — the three segments the screen calls
   *             *People*, *Clients* and *All*.
   */
  listUsers: (search?: string, page = 0, size = 25, kind?: AccountKind) =>
    http.get<Page<AdminUser>>("/admin/users", { params: { search: search || undefined, kind, page, size } }),

  getUser: (userId: string) => http.get<AdminUser>(`/admin/users/${userId}`),

  /** Back to the drawn face, woven from the account's own id. */
  drawAvatar: (userId: string) => http.put<AdminUser>(`/admin/users/${userId}/avatar`),

  /** A picture for somebody else's account — the multipart boundary is the browser's to set. */
  uploadAvatar: (userId: string, file: File) => {
    const body = new FormData()

    body.append("file", file)

    return http.post<AdminUser>(`/admin/users/${userId}/avatar`, body)
  },

  createUser: (payload: { email: string; password: string; displayName?: string; roles?: string[] }) =>
    http.post<AdminUser>("/admin/users", payload),

  updateUser: (userId: string, payload: { displayName?: string; enabled?: boolean; roles?: string[] }) =>
    http.put<AdminUser>(`/admin/users/${userId}`, payload),

  resetPassword: (userId: string, newPassword: string) =>
    http.put<void>(`/admin/users/${userId}/password`, { newPassword }),

  deleteUser: (userId: string) => http.delete<void>(`/admin/users/${userId}`),

  /**
   * Every permission the application declares.
   *
   * ⚠️ **A catalogue, not a free-text field.** A permission is a constant in the application, so a name
   * one character out does not fail — it answers **nobody**, which is the worst possible wrong answer
   * on a screen whose whole subject is who holds what.
   */
  listPermissions: () => http.get<string[]>("/admin/permissions"),

  listRoles: () => http.get<string[]>("/admin/roles"),

  getUserPermissions: (userId: string) => http.get<UserPermissionsView>(`/admin/users/${userId}/permissions`),

  setUserPermission: (userId: string, permission: string, effect: PermissionEffect) =>
    http.put<UserPermissionsView>(`/admin/users/${userId}/permissions/${permission}`, { effect }),

  removeUserPermission: (userId: string, permission: string) =>
    http.delete<UserPermissionsView>(`/admin/users/${userId}/permissions/${permission}`),
}

/**
 * ⚠️ **Every route addresses a role by NAME.** Roles are rows in the authorization library, which
 * addresses one by name so that two rows can never be two answers to one question.
 */
export const adminRolesApi = {
  list: () => http.get<RoleView[]>("/admin/roles"),

  create: (payload: { roleName: string; permissions?: string[] }) => http.post<RoleView>("/admin/roles", payload),

  update: (roleName: string, permissions: string[]) =>
    http.put<RoleView>(`/admin/roles/${encodeURIComponent(roleName)}`, { permissions }),

  delete: (roleName: string) => http.delete<void>(`/admin/roles/${encodeURIComponent(roleName)}`),
}

/**
 * An invitation code — the first half of an account in this installation.
 *
 * ⚠️ **`used`, `expired` and `valid` are the server's verdicts, not three booleans to re-derive.** A
 * browser comparing `expiresAt` against its own clock disagrees with the backend by whatever the
 * machine's clock is out by, and the disagreement shows up as a code the screen calls valid and the
 * sign-up refuses.
 */
export interface InvitationView {
  id: string
  inviteCode: string
  email: string | null
  note: string | null
  createdById: string | null
  usedById: string | null
  usedAt: string | null
  expiresAt: string | null
  createdAt: string
  used: boolean
  expired: boolean
  valid: boolean
}

export const invitationsApi = {
  list: () => http.get<InvitationView[]>("/admin/invitations"),

  create: (email: string | null, note: string | null, expiresInDays: number | null) =>
    http.post<InvitationView>("/admin/invitations", { email, note, expiresInDays }),

  revoke: (invitationId: string) => http.delete<void>(`/admin/invitations/${invitationId}`),
}

/**
 * The session an administrator has entered.
 *
 * ⚠️ **One token and no refresh token — the omission is the contract.** The session ends on its own
 * whether or not anybody remembers to leave, and nothing anywhere will renew it.
 */
export interface ImpersonationSessionResponse {
  accessToken: string
  targetUserId: string
  targetName: string
  targetEmail: string
  sessionMinutes: number
}

/** What the banner needs to name the borrowed identity and count down. */
export interface ImpersonationSessionView {
  accessToken: string
  targetUserId: string
  targetName: string
  targetEmail: string
  /** Computed once from `sessionMinutes`, so the banner counts down without asking the server the time. */
  expiresAt: string
}

/**
 * Entering and leaving another account.
 *
 * ⚠️ **Note what is missing: there is no call that trades an impersonation token for an
 * administrator's own.** That endpoint deliberately does not exist on the server either — leaving
 * restores what the browser stashed, and a lost stash costs a fresh sign-in. A convenience route back
 * would turn a leaked thirty-minute token into leaked administrative access.
 */
export const impersonationApi = {
  /** Mints the session token. Gated on `user:impersonate` and on nothing else. */
  begin: (userId: string) => http.post<ImpersonationSessionResponse>(`/impersonation/${userId}`),

  /** Records the end and revokes the borrowed token. Called with the borrowed token itself. */
  end: () => http.delete<void>("/impersonation"),
}
