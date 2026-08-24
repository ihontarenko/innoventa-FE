import { http } from "./http"

/**
 * What the caller may do, and — in the control room — what anybody may do.
 *
 * ⚠️ **Two questions, two routes, one resolver behind them.** `/me/permissions` answers about the
 * signed-in account and is gated on nothing but being signed in; `/admin/access` answers about **other
 * people**, which is a disclosure surface with its own permission and its own audit trail.
 */

/** Where a question was asked: `GLOBAL`, `ORGANIZATION:{id}` or `SPACE:{id}`. */
export interface AccessScopeView {
  type: "GLOBAL" | "ORGANIZATION" | "SPACE" | "SELF"
  id: string
  label: string
}

/**
 * Where a rule is written down — a policy file, or a row somebody inserted.
 *
 * ⚠️ **`editableAsARow` is the field to act on, never `document`.** A grant a file owns must not render
 * as a row with a delete button: somebody who presses it, sees nothing happen, and finds the permission
 * still there tomorrow has learned that the screen lies. `document` and `line` are what let it say
 * *where* instead — the difference between a refusal and an address.
 */
export interface GrantOriginView {
  document?: string
  line: number
  declared: boolean
  editableAsARow: boolean
}

/**
 * One route by which a permission arrived — or was taken away.
 *
 * ⚠️ **`origin` and `kind` answer two independent questions**, which is why they are two fields rather
 * than one enum with more cases: *how* a permission arrived (a role, an allow, a denial) and *where the
 * rule is kept* vary freely.
 */
export interface PermissionSourceView {
  kind: "ROLE_ASSIGNMENT" | "DIRECT_ALLOW" | "DIRECT_DENY" | "AGENT_CAP" | "SHARE_LINK"
  roleName?: string
  scope: AccessScopeView
  grantedBy?: string
  reason?: string
  since?: string
  summary: string
  origin?: GrantOriginView
  /** The sixth axis, written out — a grant that narrows to some rows and not others. */
  condition?: string
}

/**
 * One permission with its whole provenance chain.
 *
 * ⚠️ **`removedBy` is the point of the shape:** a permission a deny took away is not the same thing as
 * one nobody ever granted, and the difference is the only way anybody finds out why a power vanished.
 */
export interface PermissionDetailView {
  permission: string
  held: boolean
  grantedBy: PermissionSourceView[]
  removedBy: PermissionSourceView[]
}

export interface EffectivePermissionsView {
  scope: AccessScopeView
  permissions: string[]
  details: PermissionDetailView[]
}

export interface AccessSubjectView {
  userId: string
  email: string
  displayName?: string
  serviceAccount: boolean
  agentOf?: string
  reachesHere: boolean
}

/** How one module stands in the place being asked about — axes 2 to 4, beside axis 5's answer. */
export interface PlaceStandingView {
  moduleKey: string
  moduleName: string
  withinCeiling: boolean
  granted: boolean
  enabled: boolean
  blocks?: "CEILING" | "ENTITLEMENT" | "MODULE_SWITCH"
}

export interface WhoView {
  subject: AccessSubjectView
  scope: AccessScopeView
  permissions: PermissionDetailView[]
  axes: PlaceStandingView[]
}

export interface AccessHolderView {
  userId: string
  email: string
  scope: AccessScopeView
  grantedBy?: string
  reason?: string
  since?: string
}

export interface WhatView {
  permission: string
  throughRoles: Array<{ roleName: string; conferredAt: AccessScopeView; holders: AccessHolderView[] }>
  throughPersonalAllows: AccessHolderView[]
  throughPersonalDenies: AccessHolderView[]
}

/** Which of the five axes answered, in that axis's own words. */
export interface AccessDecisionView {
  granted: boolean
  axis?: "IDENTITY" | "CEILING" | "ENTITLEMENT" | "MODULE_SWITCH" | "PERMISSION"
  reason?: string
  title?: string
  words?: string
  status: number
}

export interface SimulateView {
  subject: AccessSubjectView
  permission: string
  target: string
  decision: AccessDecisionView
  provenance?: PermissionDetailView
}

/** The scope a question is asked at. Absent members mean "the installation". */
export interface AccessScopeQuery {
  spaceId?: string
  organizationId?: string
}

export const accessApi = {
  /** What *I* may do, here. ⚠️ Never the authority — every one of these is still checked server-side. */
  myPermissions: (scope: AccessScopeQuery = {}) =>
    http.get<EffectivePermissionsView>("/me/permissions", { params: scope }),

  who: (userId: string, scope: AccessScopeQuery = {}) =>
    http.get<WhoView>(`/admin/access/who/${encodeURIComponent(userId)}`, { params: scope }),

  what: (permission: string) => http.get<WhatView>(`/admin/access/what/${encodeURIComponent(permission)}`),

  simulate: (query: { userId: string; permission: string; ownerId?: string } & AccessScopeQuery) =>
    http.get<SimulateView>("/admin/access/simulate", { params: query }),
}
