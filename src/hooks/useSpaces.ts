import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { contextApi, spacesApi, type CreateSpaceRequest, type ReachableContext, type ReachableSpace } from "@/api/spaces"
import type { SpaceNavigation, SpaceSummary } from "@/types"

export function useSpaces() {
  return useQuery<SpaceSummary[]>({
    queryKey: ["spaces"],
    queryFn: () => spacesApi.list().then((response) => response.data),
    staleTime: 5 * 60_000,
  })
}

/**
 * The menu one workspace serves.
 *
 * ⚠️ **It is allowed to fail, and callers must read `isError`.** There is no client-side copy of a
 * workspace's menu to fall back to, which makes this the only source — and a hook whose failure state
 * is indistinguishable from "still loading" leaves the sidebar spinning forever.
 *
 * ⚠️ **`refetchOnWindowFocus` against the application default**, because the invalidation after a
 * module is switched off only reaches the browser that made it. Everybody else keeps the old menu until
 * something refetches, and coming back to the tab is the moment that matters.
 */
export function useSpaceNavigation(spaceId: string | null | undefined) {
  return useQuery<SpaceNavigation>({
    queryKey: ["spaces", spaceId, "navigation"],
    queryFn: () => spacesApi.getNavigation(spaceId!).then((response) => response.data),
    enabled: !!spaceId,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  })
}

/**
 * ⚠️ **Best-effort.** Recording where somebody has been must never be the thing that breaks entering a
 * workspace, so a failure here is swallowed rather than surfaced.
 */
export function useRecordSpaceVisit() {
  return useMutation({
    mutationFn: (spaceId: string) => spacesApi.recordVisit(spaceId).then(() => undefined),
    onError: () => undefined,
  })
}

/**
 * Everywhere this account can work — the hub's one request.
 *
 * ⚠️ **Ordered HERE, once.** "Most recently entered first" is what the old *Continue* block actually
 * held: that block sat above a grid and repeated cards which appeared again below under their
 * organisation — the same workspace stated twice on the one screen built to stop saying things twice,
 * and stated identically both times, since a card carries no trace of having been the recent one. What
 * it carried was an **ordering**, and an ordering belongs to the grid rather than beside it.
 *
 * ⚠️ Sorting where each grid is drawn would put the rule in three places and let an organisation's
 * cards disagree with the flat list next to them.
 */
export function useReachableContext() {
  return useQuery<ReachableContext>({
    queryKey: ["context", "reachable"],
    queryFn: () => contextApi.read().then((response) => response.data),
    select: (context) => ({ ...context, spaces: mostRecentlyVisitedFirst(context.spaces) }),
  })
}

/** Workspaces anybody here may join. ⚠️ Only asked when there is nothing to show instead. */
export function useDiscoverableSpaces(enabled: boolean) {
  return useQuery<SpaceSummary[]>({
    queryKey: ["spaces", "discoverable"],
    queryFn: () => spacesApi.discoverable().then((response) => response.data),
    enabled,
  })
}

export function useJoinSpace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (spaceId: string) => spacesApi.join(spaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["context"] })
      queryClient.invalidateQueries({ queryKey: ["spaces"] })
    },
  })
}

/**
 * Most recently entered first; the ones never entered keep the order they arrived in.
 *
 * ⚠️ The timestamps are ISO, so comparing them as text compares them as instants — and `?? ""` rather
 * than a null test, because a never-visited workspace omits the key entirely (see `ReachableSpace`).
 * The sort being stable, those keep the server's order among themselves instead of being shuffled.
 */
function mostRecentlyVisitedFirst(spaces: ReachableSpace[]): ReachableSpace[] {
  return [...spaces].sort((left, right) => (right.lastVisitedAt ?? "").localeCompare(left.lastVisitedAt ?? ""))
}

/**
 * Making one.
 *
 * ⚠️ **Every list that could show it is refetched**, including the reachable context the hub reads —
 * a workspace that exists and is invisible until a reload is a workspace somebody makes twice.
 */
export function useCreateSpace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: CreateSpaceRequest) => spacesApi.create(request).then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spaces"] })
      queryClient.invalidateQueries({ queryKey: ["context"] })
    },
  })
}
