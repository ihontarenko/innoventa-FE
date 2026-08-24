import { http } from "./http"

/**
 * What a customer has paid for — the tier they are on, what it includes, and how much is left.
 *
 * ⚠️ **This is the axis that refuses with 402 rather than 403.** A permission answers *may you*; a
 * capability answers *have you bought it*, and the two are resolved by the same engine over the same
 * addressing. Which is why nothing here decides anything: it reads what the engine resolved and writes
 * through the one port that may change it.
 *
 * ⚠️ **Which tiers exist is not this screen's to say.** `plans { }` lives in the policy document —
 * versioned, rehearsable, revertible — and is seeded into rows. This administers *who is on what*, and
 * has no "new plan" button on purpose.
 */

/** How a capability is counted. A MODULE is on or off; the other two carry a number. */
export type CapabilityKind = "MODULE" | "LIMIT" | "QUOTA"

/** The window a quota is counted over. `EVER` is a lifetime total rather than a period. */
export type CapabilityPeriod = "DAY" | "MONTH" | "YEAR" | "EVER"

/**
 * One line of a tier.
 *
 * @property words already written by the backend — "3 workspaces in total", "Unlimited seats". The
 *           sentence is the product's knowledge of what a unit means, and re-deriving it here would put
 *           a second, worse copy of that knowledge in the browser.
 */
export interface PlanLine {
  capability: string
  label: string
  kind: CapabilityKind
  allowance: number | null
  period: CapabilityPeriod | null
  words: string
}

export interface Plan {
  id: string
  code: string
  name: string
  description: string | null
  includes: PlanLine[]
}

/**
 * One grant, with its provenance.
 *
 * @property source what makes a gift visibly not part of the tier. Somebody who was *given* something
 *           must be able to see that they were, or they will assume it is included and be wrong later —
 *           at the moment they downgrade.
 * @property grantedBy who decided, by name. Null on a plan grant: nobody decided that by hand, and
 *           *by whom* is a question with an answer only where a person is the answer.
 * @property active an expired trial stays in the list saying when it ended, rather than vanishing.
 */
export interface Grant {
  id: string
  subjectType: "ORGANIZATION" | "SPACE" | "MEMBERSHIP"
  subjectId: string
  capability: string
  capabilityLabel: string
  kind: "ALLOW" | "DENY"
  source: "PLAN" | "PURCHASE" | "GRANT" | "TRIAL"
  validFrom: string
  validUntil: string | null
  /** Null on a module; null on a metered capability means no ceiling. */
  allowance: number | null
  period: CapabilityPeriod | null
  reason: string | null
  words: string
  grantedBy: string | null
  active: boolean
}

/**
 * How much of one thing is allowed, and how much is used.
 *
 * @property unitPlural declared, not derived — `entry` pluralises to `entries`, and "0 entrys" on a
 *           paying customer's screen is the kind of small wrongness that makes a product look unfinished.
 * @property resetsAt when the window ends, or null where only a plan change raises it.
 */
export interface Usage {
  capability: string
  label: string
  unit: string | null
  unitPlural: string | null
  granted: boolean
  unlimited: boolean
  allowance: number | null
  used: number
  remaining: number | null
  period: CapabilityPeriod | null
  resetsAt: string | null
  words: string | null
}

export interface OrganizationPlan {
  organizationId: string
  organizationSlug: string
  organizationName: string
  plan: Plan
  /** When a running trial ends, or null where none is running. */
  trialUntil: string | null
  grants: Grant[]
  usage: Usage[]
}

export interface AdministeredOrganization {
  id: string
  slug: string
  name: string
  ownerEmail: string
  /** ⚠️ Null where nothing has put this account on a tier — read off its grants, not off a column. */
  planCode: string | null
  planName: string | null
  trialUntil: string | null
  spaceCount: number
  seatCount: number
}

/**
 * The customer's own view of what they are on.
 *
 * Read-only, and needs no permission: changing a plan is `plan:administer` and lives on the platform's
 * screen. What gates this is reaching the organisation at all, which the navigation context answers.
 */
export const organizationPlanApi = {
  forSlug: (organizationSlug: string) => http.get<OrganizationPlan>(`/organizations/${organizationSlug}/plan`),
}

/** The plan catalogue, which organisation is on what, and everything that changes either. */
export const planAdministrationApi = {
  catalogue: () => http.get<Plan[]>("/plan-administration/plans"),

  organizations: () => http.get<AdministeredOrganization[]>("/plan-administration/organizations"),

  organization: (organizationId: string) =>
    http.get<OrganizationPlan>(`/plan-administration/organizations/${organizationId}`),

  assignPlan: (organizationId: string, payload: { planCode: string }) =>
    http.put<OrganizationPlan>(`/plan-administration/organizations/${organizationId}/plan`, payload),

  startTrial: (organizationId: string, payload: { planCode: string; until: string }) =>
    http.post<OrganizationPlan>(`/plan-administration/organizations/${organizationId}/trial`, payload),

  endTrial: (organizationId: string) =>
    http.delete<OrganizationPlan>(`/plan-administration/organizations/${organizationId}/trial`),

  /**
   * Gives an organisation something outside its plan. Issued with `source: GRANT`, which is what makes
   * it survive every plan change after it.
   */
  issueGift: (
    organizationId: string,
    payload: {
      capability: string
      reason: string
      allowance?: number | null
      period?: string | null
      until?: string | null
    },
  ) => http.post<OrganizationPlan>(`/plan-administration/organizations/${organizationId}/grants`, payload),

  withdrawGrant: (grantId: string) => http.delete<void>(`/plan-administration/grants/${grantId}`),
}

// ── Governing workspaces from the platform ───────────────────────────────────
//
// ⚠️ Not under `/api/admin`: everything there is role-gated server-side, and a route checking both a
// role and a permission makes the permission decorative. These are gated on `space:read` held over
// the whole INSTALLATION — the scope IS the distinction — and writing a deny is
// `space:module:restrict`, because looking at an arrangement is not changing it.

/**
 * How a module stands in one workspace.
 *
 * @property verdict `FREE` needs no grant · `GRANTED` has one · `WITHHELD` has a deny with words in it
 *           · `NOT_INCLUDED` is the plan gate. Four rather than two, because *why* is as much of the
 *           answer as *whether*, and a screen that only knew granted-or-not would have to invent the
 *           words.
 * @property words the one sentence a customer can act on, already written by the backend.
 */
export interface ModuleEntitlement {
  verdict: "FREE" | "GRANTED" | "WITHHELD" | "NOT_INCLUDED"
  granted: boolean
  source: "PLAN" | "PURCHASE" | "GRANT" | "TRIAL" | null
  reason: string | null
  words: string | null
  until: string | null
}

/**
 * @property switchable false with a granted entitlement means infrastructure: a screen over somebody
 *           else's endpoints runs on it, so it is always on and there is nothing to switch.
 */
export interface SpaceModule {
  key: string
  name: string
  enabled: boolean
  forced: boolean
  switchable: boolean
  entitlement: ModuleEntitlement | null
  readsThrough: string[]
}

export interface SpaceMemberRow {
  userId: string
  email: string
  displayName: string | null
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"
  joinedAt: string
}

export interface AdministeredSpace {
  id: string
  name: string
  slug: string
  subjectAreaCode: string
  subjectAreaLabel: string
  organizationId: string
  organizationSlug: string
  organizationName: string
  /** ⚠️ Null where nothing has put this account on a tier — read off its grants, not off a column. */
  planCode: string | null
  planName: string | null
  ownerEmail: string
  ownerDisplayName: string | null
  memberCount: number
  discoverable: boolean
  enabled: boolean
  createdAt: string
}

export interface AdministeredSpaceDetail {
  space: AdministeredSpace
  members: SpaceMemberRow[]
  modules: SpaceModule[]
  /** What this workspace itself holds. Its organisation's grants are on the plan screen. */
  grants: Grant[]
}

export const workspaceAdministrationApi = {
  list: (search?: string) =>
    http.get<AdministeredSpace[]>("/workspace-administration", { params: search ? { search } : undefined }),

  /** ⚠️ Opening somebody else's workspace is a sensitive read and is recorded server-side. */
  open: (spaceId: string) => http.get<AdministeredSpaceDetail>(`/workspace-administration/${spaceId}`),

  withhold: (spaceId: string, capability: string, payload: { reason: string }) =>
    http.put<AdministeredSpaceDetail>(
      `/workspace-administration/${spaceId}/capabilities/${capability}/withholding`,
      payload,
    ),

  release: (spaceId: string, capability: string) =>
    http.delete<AdministeredSpaceDetail>(`/workspace-administration/${spaceId}/capabilities/${capability}/withholding`),
}
