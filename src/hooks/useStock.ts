import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  stockApi,
  type AdjustRequest,
  type LowPosition,
  type Movement,
  type MovementFilter,
  type PartStock,
  type PartTotal,
  type StockSummary,
} from "@/api/stock"
import { projectsApi } from "@/api/projects"
import type { Page } from "@/api/forms"
import type { FormEntry } from "@/types"
import { useSpaceStore } from "@/stores/spaceStore"

/**
 * Quantities, and why they changed.
 *
 * ⚠️ **Every read here is workspace-scoped even though none of them names a workspace.** The backend
 * takes it from the active-space context; the id is in the key so that switching workspaces does not
 * show the previous one's shelves while the new answer is in flight.
 */

/**
 * What the workspace holds, and its breakdown by component type.
 *
 * ⚠️ **One hook, so the strip above the table and the type rail beside it are one request.** The
 * breakdown is grouped by the form of each position's *part*, which is exactly what the rail needs and
 * exactly what the rows themselves cannot say — every position is an entry of one form.
 */
export function useStockSummary(enabled = true) {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  return useQuery<StockSummary>({
    queryKey: ["stock-summary", spaceId],
    queryFn: () => stockApi.summary().then((response) => response.data),
    enabled: Boolean(spaceId) && enabled,
    staleTime: 30_000,
  })
}

/** Every box under its own minimum, deepest shortfall first. */
export function useLowStock(enabled = true) {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  return useQuery<LowPosition[]>({
    queryKey: ["stock", "low", spaceId],
    queryFn: () => stockApi.low().then((response) => response.data),
    enabled: Boolean(spaceId) && enabled,
    staleTime: 30_000,
  })
}

/**
 * The inventory listing, narrowed by component type, part, place or being under the minimum.
 *
 * ⚠️ **Enabled only when a stock narrowing is actually in play.** With no filter this answers the same
 * page the ordinary entries listing does, so running both would be two requests for one table — the
 * screen keeps its usual path until one of these is asked for.
 */
export function useStockPositions(
  filter: { partFormId?: string; partId?: string; low?: boolean; locationId?: string; query?: string },
  page: number,
  size: number,
  enabled: boolean,
) {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  return useQuery<Page<FormEntry>>({
    queryKey: ["stock", "positions", spaceId, filter, page, size],
    queryFn: () => stockApi.positions(filter, page, size).then((response) => response.data),
    enabled: Boolean(spaceId) && enabled,
    placeholderData: keepPreviousData,
  })
}

/** How much of one part is held, and in which places. */
export function usePartStock(partId: string | null) {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  return useQuery<PartStock>({
    queryKey: ["stock", "part", spaceId, partId],
    queryFn: () => stockApi.byPart(partId!).then((response) => response.data),
    enabled: Boolean(spaceId && partId),
  })
}

/**
 * On-hand totals for a whole page of parts.
 *
 * ⚠️ **The ids are part of the key, sorted and joined.** A listing re-renders with the same parts in a
 * different order all the time, and keying by the array's identity would refetch on every one of them.
 */
export function usePartTotals(partIds: string[]) {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)
  const key = [...partIds].sort().join(",")

  return useQuery<Record<string, PartTotal>>({
    queryKey: ["stock", "totals", spaceId, key],
    queryFn: () => stockApi.totals(partIds).then((response) => response.data),
    enabled: Boolean(spaceId) && partIds.length > 0,
    staleTime: 30_000,
  })
}

/**
 * How much of each part is spoken for, across every project in the workspace.
 *
 * ⚠️ **A refusal here is not an error worth showing.** The answer is gated on being able to see
 * projects at all, so a reader without that permission gets nothing and the column that would have used
 * it simply does not draw — which is the honest outcome, not a broken screen.
 */
export function usePartReservations(partIds: string[]) {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)
  const key = [...partIds].sort().join(",")

  return useQuery<Record<string, number>>({
    queryKey: ["stock", "reserved", spaceId, key],
    queryFn: () => projectsApi.reservations(partIds).then((response) => response.data),
    enabled: Boolean(spaceId) && partIds.length > 0,
    staleTime: 30_000,
    retry: false,
  })
}

/** One position's history, newest first. */
export function useMovementsOf(entryId: string | null, page = 0) {
  return useQuery<Page<Movement>>({
    queryKey: ["stock", "movements", entryId, page],
    queryFn: () => stockApi.movementsOf(entryId!, page).then((response) => response.data),
    enabled: Boolean(entryId),
  })
}

/** The workspace journal, newest first. */
export function useMovements(filter: MovementFilter = {}, page = 0) {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  return useQuery<Page<Movement>>({
    queryKey: ["stock", "journal", spaceId, filter, page],
    queryFn: () => stockApi.movements(filter, page).then((response) => response.data),
    enabled: Boolean(spaceId),
  })
}

/**
 * Move a position's quantity by recording why it moved.
 *
 * ⚠️ **Everything about stock is invalidated, not just the row.** A movement changes what the part
 * holds altogether, which changes whether every other position of it reads as low, what the summary
 * totals say, and whether a project's bill of materials is covered. Patching one row into the cache
 * would leave four screens quietly disagreeing with the shelf.
 */
export function useAdjustStock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ entryId, ...request }: AdjustRequest & { entryId: string }) =>
      stockApi.adjust(entryId, request).then((response) => response.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["stock"] })
      // ⚠️ A key of its own, so `["stock"]` does not reach it. The strip above the table and the type
      // rail beside it both read this — leave it out and a movement changes the row and nothing else.
      void queryClient.invalidateQueries({ queryKey: ["stock-summary"] })
      void queryClient.invalidateQueries({ queryKey: ["entries"] })
      void queryClient.invalidateQueries({ queryKey: ["attention"] })
      void queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })
}
