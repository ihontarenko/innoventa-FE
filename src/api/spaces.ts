import { http } from "./http"
import type { FormSummary, SpaceNavigation, SpaceSummary } from "@/types"
import type { SpaceModule } from "./entitlements"
import type { Page } from "./forms"

export const spacesApi = {
  list: () => http.get<SpaceSummary[]>("/spaces"),

  /**
   * ⚠️ **The menu one workspace serves — already filtered to what the caller may open.** Whether an
   * item may be shown is the same question as whether the endpoint behind it will answer, and only the
   * backend can answer that. There is deliberately no client-side copy to fall back to: what a
   * workspace shows follows from what it counts, so a copy here could only ever be one subject area's
   * menu painted into every workspace.
   */
  getNavigation: (spaceId: string) => http.get<SpaceNavigation>(`/spaces/${spaceId}/navigation`),

  recordVisit: (spaceId: string) => http.post<void>(`/spaces/${spaceId}/visit`),

  /** Workspaces that let anybody in this installation join them. */
  discoverable: () => http.get<SpaceSummary[]>("/spaces/discoverable"),

  create: (request: CreateSpaceRequest) => http.post<SpaceSummary>("/spaces", request),

  /**
   * Whether a slug is free.
   *
   * ⚠️ **Taken answers 409, not `{ available: false }`.** The 200 body says `true` and nothing else ever
   * does — so a caller that reads the body without catching the rejection concludes "free" for every
   * slug that is taken, which is the one answer that matters.
   */
  checkSlug: (slug: string) => http.get<{ available: boolean; slug: string }>("/spaces/check-slug", { params: { slug } }),

  join: (spaceId: string) => http.post<void>(`/spaces/${spaceId}/join`),
}

/**
 * A new workspace.
 *
 * ⚠️ **`slug` is not decoration — it is the address**, and the backend refuses anything but lowercase
 * letters, digits and single hyphens (`^[a-z0-9]+(?:-[a-z0-9]+)*$`). It is derived from the name and
 * stays editable, because a name with an apostrophe or a Cyrillic word makes a slug nobody would choose.
 *
 * ⚠️ **`subjectAreaCode` decides what the workspace IS**, not how it is filed: the menu, the modules and
 * half the screens follow from it. It is optional here only because the backend has a default.
 */
export interface CreateSpaceRequest {
  name: string
  slug: string
  description?: string
  subjectAreaCode?: string
}

/**
 * One workspace as the hub needs it — with what it counts, and when you were last in it.
 *
 * ⚠️ **`lastVisitedAt` is OPTIONAL, not nullable.** Innoventa serialises non-null only, so a workspace
 * nobody has entered arrives with the key **absent** rather than set to `null` — and every
 * `=== null` test written against it is silently false. Sort on `?? ""`, never on a null check.
 */
export interface ReachableSpace {
  id: string
  slug: string
  name: string
  description?: string
  subjectAreaCode: string
  subjectAreaLabel: string
  subjectAreaIcon?: string
  currentUserRole?: string
  memberCount: number
  organizationId: string
  lastVisitedAt?: string
}

export interface ReachableOrganization {
  id: string
  slug: string
  name: string
  spaceIds: string[]
}

/**
 * Everywhere this account can work, in one request.
 *
 * ⚠️ **`organizationsVisible` is the installation's answer, not a preference.** An installation with one
 * organisation has nothing to group by, and drawing the grouping anyway is a level of nesting around a
 * single node.
 */
export interface ReachableContext {
  organizationsVisible: boolean
  organizations: ReachableOrganization[]
  spaces: ReachableSpace[]
}

export const contextApi = {
  read: () => http.get<ReachableContext>("/navigation"),
}

export type SpaceMemberRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"

export interface SpaceMember {
  userId: string
  email: string
  displayName: string | null
  role: SpaceMemberRole
  joinedAt: string
}

export interface SpaceDetail {
  id: string
  name: string
  slug: string
  description: string | null
  enabled: boolean
  discoverable: boolean
  subjectAreaCode: string
  subjectAreaLabel: string
  members: SpaceMember[]
  currentUserRole: SpaceMemberRole
  createdAt: string
  updatedAt: string
}

/** What a workspace may count — the answer everything else on its settings screen follows. */
export interface SubjectArea {
  code: string
  label: string
  description: string | null
}

/**
 * A form as one workspace lists it.
 *
 * ⚠️ **The whole summary, not a thinner shape.** The screens that read this list draw a status, a field
 * count and a purpose from it — a narrower type here would make every one of them fetch the form again
 * just to render a card.
 */
export interface SpaceForm extends FormSummary {
  /** Where the workspace put it in its own order, or null while it has never been arranged. */
  sortOrder: number | null
}

/** Everything about one workspace that is decided from inside it. */
export const spaceSettingsApi = {
  get: (spaceId: string) => http.get<SpaceDetail>(`/spaces/${spaceId}`),

  update: (
    spaceId: string,
    payload: {
      name?: string
      description?: string
      discoverable?: boolean
      subjectAreaCode?: string
    },
  ) => http.patch<SpaceDetail>(`/spaces/${spaceId}`, payload),

  delete: (spaceId: string) => http.delete<void>(`/spaces/${spaceId}`),

  inviteMember: (spaceId: string, payload: ({ userId: string } | { email: string }) & { role: string }) =>
    http.post<SpaceDetail>(`/spaces/${spaceId}/members`, payload),

  updateMemberRole: (spaceId: string, userId: string, role: string) =>
    http.put<SpaceDetail>(`/spaces/${spaceId}/members/${userId}`, { role }),

  removeMember: (spaceId: string, userId: string) => http.delete<void>(`/spaces/${spaceId}/members/${userId}`),

  leave: (spaceId: string) => http.delete<void>(`/spaces/${spaceId}/members/me`),

  subjectAreas: () => http.get<SubjectArea[]>("/subject-areas"),

  forms: (spaceId: string) => http.get<SpaceForm[]>(`/spaces/${spaceId}/forms`),

  /**
   * ⚠️ **The paged route, narrowed by PURPOSE.** A workspace showing four hundred forms and a screen
   * that wants only the component types is the case this exists for; filtering the flat list in the
   * browser would fetch all four hundred to draw twelve.
   *
   * ⚠️ **Several purposes are asked for by passing an array.** One screen showing two kinds of
   * catalogue is the case: they are the same question asked about different things, and splitting them
   * into two requests would page each one separately and make a single ordered list impossible.
   *
   * ⚠️ **Joined with a comma HERE, deliberately, rather than handed to Axios as an array.** Axios
   * serialises an array as `purposeCode[]=A&purposeCode[]=B`, and a backend reading `purposeCode` finds
   * no such parameter — so the filter is silently dropped and the screen fills with every form in the
   * workspace. A comma-separated value binds to a list on the other side and reads identically when
   * there is only one.
   */
  formsPaged: (spaceId: string, page: number, size: number, purposeCode?: string | string[]) =>
    http.get<Page<SpaceForm>>(`/spaces/${spaceId}/forms/paged`, {
      params: {
        page,
        size,
        purposeCode: Array.isArray(purposeCode) ? purposeCode.join(",") : purposeCode,
      },
    }),

  availableForms: (spaceId: string) => http.get<SpaceForm[]>(`/spaces/${spaceId}/forms/available`),

  addForm: (spaceId: string, formId: string) => http.post<void>(`/spaces/${spaceId}/forms/${formId}`),

  removeForm: (spaceId: string, formId: string) => http.delete<void>(`/spaces/${spaceId}/forms/${formId}`),
}

/**
 * Which modules a workspace has, and which of them are on.
 *
 * ⚠️ **Withholding is not here.** It is governance over somebody else's workspace and lives on
 * `workspaceAdministrationApi`, behind installation-wide `space:read`.
 */
export const modulesApi = {
  listForSpace: (spaceId: string) => http.get<SpaceModule[]>(`/spaces/${spaceId}/modules`),

  setModule: (spaceId: string, moduleKey: string, payload: { enabled: boolean; forced: boolean }) =>
    http.put<SpaceModule[]>(`/spaces/${spaceId}/modules/${moduleKey}`, payload),
}
