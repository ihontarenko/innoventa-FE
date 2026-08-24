import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { viewsApi, type SavedView } from "@/api/views"
import { useSpaceStore } from "@/stores/spaceStore"

/** The views this person keeps on one board. */
export function useSavedViews(section: string) {
  const spaceId = useSpaceStore((store) => store.activeSpaceId)

  return useQuery<SavedView[]>({
    queryKey: ["views", spaceId, section],
    queryFn: () => viewsApi.mine(section).then((response) => response.data),
    enabled: Boolean(spaceId),
  })
}

/** Every view this person keeps here — what the menu draws its pinned ones from. */
export function useAllSavedViews() {
  const spaceId = useSpaceStore((store) => store.activeSpaceId)

  return useQuery<SavedView[]>({
    queryKey: ["views", spaceId, "all"],
    queryFn: () => viewsApi.mine().then((response) => response.data),
    enabled: Boolean(spaceId),
  })
}

/**
 * ⚠️ **Every one of these invalidates `["views"]` whole**, not the one section's key. A pin changes the
 * menu, which reads the unfiltered list — so a narrower invalidation would leave somebody's newly pinned
 * view missing from the sidebar until a reload, which reads as the pin not having worked.
 */
export function useSaveView() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: { name: string; section: string; filter: string; pinned?: boolean }) =>
      viewsApi.save(payload).then((response) => response.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["views"] }),
  })
}

export function usePinView() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ viewId, pinned }: { viewId: string; pinned: boolean }) =>
      viewsApi.pin(viewId, pinned).then((response) => response.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["views"] }),
  })
}

export function useForgetView() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (viewId: string) => viewsApi.forget(viewId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["views"] }),
  })
}
