import { useQuery } from "@tanstack/react-query"
import {
  accessApi,
  type AccessScopeQuery,
  type EffectivePermissionsView,
  type SimulateView,
  type WhatView,
  type WhoView,
} from "@/api/access"

/**
 * The three questions `/admin/access` asks, and the one property they all share: **they are about other
 * people.**
 *
 * ⚠️ **Nothing else in the product does that**, so each is a sensitive read, recorded server-side the
 * moment it is served — and each is fetched **on demand rather than eagerly**. A screen that pre-fetches
 * every person's effective set writes an audit entry for everybody the administrator never looked at,
 * which turns the trail into noise on the day somebody reads it.
 */
const ACCESS_KEYS = {
  who: (userId: string, scope: AccessScopeQuery) =>
    ["access", "who", userId, scope.spaceId ?? null, scope.organizationId ?? null] as const,
  what: (permission: string) => ["access", "what", permission] as const,
  simulate: (query: object) => ["access", "simulate", query] as const,
}

/** Everything one person effectively holds, each with the chain that decided it. */
export function useAccessWho(userId?: string, scope: AccessScopeQuery = {}) {
  return useQuery<WhoView>({
    queryKey: ACCESS_KEYS.who(userId ?? "", scope),
    queryFn: () => accessApi.who(userId!, scope).then((response) => response.data),
    enabled: !!userId,
  })
}

/** Everybody who holds one permission, grouped by how they came by it. */
export function useAccessWhat(permission?: string) {
  return useQuery<WhatView>({
    queryKey: ACCESS_KEYS.what(permission ?? ""),
    queryFn: () => accessApi.what(permission!).then((response) => response.data),
    enabled: !!permission,
  })
}

/**
 * The real decision, run for real.
 *
 * ⚠️ **Deliberately not cached at all.** A simulation is asked because somebody has just changed
 * something and wants to know whether it took; an answer from thirty seconds ago is the one thing this
 * screen must never show.
 */
export function useAccessSimulation(
  query: { userId?: string; permission?: string; ownerId?: string } & AccessScopeQuery,
  enabled: boolean,
) {
  return useQuery<SimulateView>({
    queryKey: ACCESS_KEYS.simulate(query),
    queryFn: () =>
      accessApi
        .simulate({ ...query, userId: query.userId!, permission: query.permission! })
        .then((response) => response.data),
    enabled: enabled && !!query.userId && !!query.permission,
    staleTime: 0,
    gcTime: 0,
  })
}

/**
 * What *I* may do — and, with no scope passed, what I hold over the **installation**.
 *
 * ⚠️ **A permission held in one workspace is not a permission the account has.** Reading the active
 * workspace's answer on an account screen would tell somebody they are an administrator because they
 * administer one place.
 *
 * ⚠️ It is a disclosure about *you* and needs no permission — `/admin/access` is the screen that answers
 * the same question about somebody else, and that one has a permission of its own.
 */
export function useMyPermissions(scope: AccessScopeQuery = {}) {
  return useQuery<EffectivePermissionsView>({
    queryKey: ["me", "permissions", scope.spaceId ?? null, scope.organizationId ?? null],
    queryFn: () => accessApi.myPermissions(scope).then((response) => response.data),
    staleTime: 60_000,
  })
}
