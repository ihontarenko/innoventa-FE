import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  stocktakesApi,
  type CreateStocktakeRequest,
  type Stocktake,
  type StocktakeStatus,
} from "@/api/stocktakes"
import { useSpaceStore } from "@/stores/spaceStore"

/**
 * ⚠️ **The workspace is in every key even though no request carries it.** The backend reads the active
 * workspace from the request's own context, so two workspaces answer the same URL with different sheets
 * — and a cache keyed without it hands one workspace's counts to the next one opened.
 */
export function useStocktakes(status: StocktakeStatus | null, page = 0, size = 25) {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  return useQuery({
    queryKey: ["stocktakes", spaceId, status, page, size],
    queryFn: () => stocktakesApi.list(status, page, size).then((response) => response.data),
    enabled: Boolean(spaceId),
  })
}

export function useStocktake(id: string | undefined) {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  return useQuery({
    queryKey: ["stocktake", spaceId, id],
    queryFn: () => stocktakesApi.get(id!).then((response) => response.data),
    enabled: Boolean(spaceId && id),
  })
}

export function useCreateStocktake() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: CreateStocktakeRequest) =>
      stocktakesApi.create(request).then((response) => response.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stocktakes"] }),
  })
}

/**
 * Writing one count.
 *
 * ⚠️ **The whole sheet comes back and is written into the cache directly**, rather than invalidating
 * and refetching. A counter types a number and presses Enter perhaps a hundred times; a refetch per
 * keystroke-row would make the screen flicker and the totals lag behind the row that produced them.
 */
export function useCountLine(stocktakeId: string | undefined) {
  const queryClient = useQueryClient()
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  return useMutation({
    mutationFn: ({ entryId, counted }: { entryId: string; counted: number }) =>
      stocktakesApi.count(stocktakeId!, entryId, counted).then((response) => response.data),
    onSuccess: (sheet: Stocktake) => {
      queryClient.setQueryData(["stocktake", spaceId, stocktakeId], sheet)
      queryClient.invalidateQueries({ queryKey: ["stocktakes"] })
    },
  })
}

export function useClearCount(stocktakeId: string | undefined) {
  const queryClient = useQueryClient()
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  return useMutation({
    mutationFn: (entryId: string) =>
      stocktakesApi.clearCount(stocktakeId!, entryId).then((response) => response.data),
    onSuccess: (sheet: Stocktake) =>
      queryClient.setQueryData(["stocktake", spaceId, stocktakeId], sheet),
  })
}

export function useStartStocktake(stocktakeId: string | undefined) {
  const queryClient = useQueryClient()
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  return useMutation({
    mutationFn: () => stocktakesApi.start(stocktakeId!).then((response) => response.data),
    onSuccess: (sheet: Stocktake) => {
      queryClient.setQueryData(["stocktake", spaceId, stocktakeId], sheet)
      queryClient.invalidateQueries({ queryKey: ["stocktakes"] })
    },
  })
}

/**
 * ⚠️ **Closing invalidates the inventory and the register too, not just the sheet.** It writes one
 * movement per discrepancy, so every quantity on screen may have just changed — leaving those caches
 * alone would show corrected stock as uncorrected until something else happened to refetch.
 */
export function useCloseStocktake(stocktakeId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => stocktakesApi.close(stocktakeId!).then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stocktake"] })
      queryClient.invalidateQueries({ queryKey: ["stocktakes"] })
      queryClient.invalidateQueries({ queryKey: ["stock"] })
      queryClient.invalidateQueries({ queryKey: ["entries"] })
      queryClient.invalidateQueries({ queryKey: ["journal"] })
    },
  })
}

export function useDeleteStocktake() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => stocktakesApi.remove(id).then(() => undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stocktakes"] }),
  })
}
