import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  custodyApi,
  type Asset,
  type AssetDetail,
  type AssetFilter,
  type CustodyCondition,
  type Holder,
  type PickableForm,
} from "@/api/custody"
import type { Page } from "@/api/forms"
import { useSpaceStore } from "@/stores/spaceStore"

/**
 * ⚠️ **Every key carries the workspace even though no request does.** The scope travels in a header, so
 * two workspaces' answers would otherwise share one cache entry and the second would read the first's
 * board — the one failure mode that looks like a data leak and is really a cache key.
 */
const CUSTODY_KEYS = {
  all: ["custody"] as const,
  assets: (spaceId: string | null, filter: AssetFilter, page: number) =>
    ["custody", "assets", spaceId, filter, page] as const,
  asset: (spaceId: string | null, assetId: string) => ["custody", "assets", spaceId, assetId] as const,
  holders: (spaceId: string | null) => ["custody", "holders", spaceId] as const,
  vocabulary: (spaceId: string | null, kind: string) => ["custody", kind, spaceId] as const,
}

export function useAssets(
  filter: AssetFilter,
  page = 0,
  size = 25,
  jmq: { filter?: string | null; order?: string | null } = {},
) {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  return useQuery<Page<Asset>>({
    // ⚠️ The expression is part of the key. Left out, the cache would answer a narrowed listing with the
    // rows of an unnarrowed one — which looks like a filter that silently does nothing.
    queryKey: [...CUSTODY_KEYS.assets(spaceId, filter, page), jmq.filter ?? null, jmq.order ?? null],
    queryFn: () => custodyApi.assets(page, size, filter, jmq).then((response) => response.data),
    enabled: Boolean(spaceId),
    placeholderData: keepPreviousData,
  })
}

export function useAsset(assetId: string | undefined) {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  return useQuery<AssetDetail>({
    queryKey: CUSTODY_KEYS.asset(spaceId, assetId ?? ""),
    queryFn: () => custodyApi.asset(assetId!).then((response) => response.data),
    enabled: Boolean(assetId),
  })
}

export function useHolders() {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  return useQuery<Holder[]>({
    queryKey: CUSTODY_KEYS.holders(spaceId),
    queryFn: () => custodyApi.holders().then((response) => response.data),
    enabled: Boolean(spaceId),
  })
}

export function useAssetForms() {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  return useQuery<PickableForm[]>({
    queryKey: CUSTODY_KEYS.vocabulary(spaceId, "asset-forms"),
    queryFn: () => custodyApi.assetForms().then((response) => response.data),
    enabled: Boolean(spaceId),
    staleTime: 5 * 60_000,
  })
}

export function useHolderForms() {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  return useQuery<PickableForm[]>({
    queryKey: CUSTODY_KEYS.vocabulary(spaceId, "holder-forms"),
    queryFn: () => custodyApi.holderForms().then((response) => response.data),
    enabled: Boolean(spaceId),
    staleTime: 5 * 60_000,
  })
}

export function useCustodyConditions() {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  return useQuery<CustodyCondition[]>({
    queryKey: CUSTODY_KEYS.vocabulary(spaceId, "conditions"),
    queryFn: () => custodyApi.conditions().then((response) => response.data),
    enabled: Boolean(spaceId),
    staleTime: 5 * 60_000,
  })
}

/**
 * ⚠️ **A movement invalidates everything under `custody`, and that is the honest cost.** Issuing one
 * thing changes the board, the thing's own history, and the holding and overdue counts of *two* people —
 * so the only thing a narrower invalidation could buy is a screen that quietly disagrees with itself.
 */
function useMovementMutation<Variables, Result>(send: (variables: Variables) => Promise<Result>) {
  const queryClient = useQueryClient()

  return useMutation<Result, unknown, Variables>({
    mutationFn: send,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CUSTODY_KEYS.all }),
  })
}

export function useRegisterAsset() {
  return useMovementMutation((payload: Parameters<typeof custodyApi.register>[0]) =>
    custodyApi.register(payload).then((response) => response.data),
  )
}

export function useIssueAsset() {
  return useMovementMutation(
    ({ assetId, ...payload }: { assetId: string } & Parameters<typeof custodyApi.issue>[1]) =>
      custodyApi.issue(assetId, payload).then((response) => response.data),
  )
}

export function useReturnAsset() {
  return useMovementMutation(
    ({ assetId, ...payload }: { assetId: string } & Parameters<typeof custodyApi.returnToPlace>[1]) =>
      custodyApi.returnToPlace(assetId, payload).then((response) => response.data),
  )
}

export function useTransferAsset() {
  return useMovementMutation(
    ({ assetId, ...payload }: { assetId: string } & Parameters<typeof custodyApi.transfer>[1]) =>
      custodyApi.transfer(assetId, payload).then((response) => response.data),
  )
}

export function useWriteOffAsset() {
  return useMovementMutation(({ assetId, note }: { assetId: string; note: string }) =>
    custodyApi.writeOff(assetId, { note }).then((response) => response.data),
  )
}
