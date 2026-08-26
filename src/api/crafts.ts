import { http } from "./http"

/**
 * An organisation's crafts — what its people **do**, never what they **may** do.
 *
 * ⚠️ **Nothing here carries a permission, a module or a capability, and that absence is the contract.**
 * A craft decides what somebody is shown first; a screen that received a list of things a craft
 * "allows" would be a screen an administrator reasonably manages as a role. The only thing a craft
 * names is an ordered list of keys, and the one consumer of those permutes a list the permission gate
 * has already filtered.
 */

export interface Craft {
  id: string
  /** Stable across renaming — what an ordering preference records. Not editable after creation. */
  key: string
  name: string
  description?: string
  icon?: string
  sortOrder: number
  /** What this craft puts first, in order. ⚠️ Never a grant. */
  preferredKeys: string[]
  /** How many people hold it, so removing one can say what it detaches. */
  memberCount: number
}

export interface MemberCraft {
  userId: string
  craftId: string
  craftName: string
}

export interface CraftRequest {
  key: string
  name: string
  description?: string
  icon?: string
  sortOrder: number
  preferredKeys: string[]
}

export const craftsApi = {
  list: (organizationId: string) => http.get<Craft[]>(`/organizations/${organizationId}/crafts`),

  /**
   * The craft this caller holds here, or none.
   *
   * ⚠️ `craft` arrives absent where they hold none, and that is ORDINARY — they get the default order
   * and everything they are permitted. Reading its absence as a restriction inverts the concept.
   */
  mine: (organizationId: string) =>
    http.get<{ craft?: Craft }>(`/organizations/${organizationId}/crafts/mine`),

  held: (organizationId: string) =>
    http.get<MemberCraft[]>(`/organizations/${organizationId}/crafts/held`),

  create: (organizationId: string, payload: CraftRequest) =>
    http.post<Craft>(`/organizations/${organizationId}/crafts`, payload),

  update: (organizationId: string, craftId: string, payload: CraftRequest) =>
    http.put<Craft>(`/organizations/${organizationId}/crafts/${craftId}`, payload),

  /** ⚠️ Detaches whoever held it and refuses nothing — a member with no craft is ordinary. */
  remove: (organizationId: string, craftId: string) =>
    http.delete<void>(`/organizations/${organizationId}/crafts/${craftId}`),

  /** ⚠️ A null `craftId` clears it, and clearing takes nothing away from anybody. */
  assign: (organizationId: string, userId: string, craftId: string | null) =>
    http.put<void>(`/organizations/${organizationId}/crafts/held/${userId}`, { craftId }),
}
