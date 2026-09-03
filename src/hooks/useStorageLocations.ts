import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  storageLocationsApi,
  type EntryLocation,
  type LocationItem,
  type StorageLocation,
} from "@/api/storageLocations"

const LOCATION_KEYS = {
  tree: ["storage-locations"] as const,
  contents: (locationId: string) => ["storage-locations", locationId, "items"] as const,
  whereIs: (entryId: string) => ["storage-locations", "entry", entryId] as const,
}

/** ⚠️ Arrives already nested, unlike the folder tree — the children are in the payload. */
export function useStorageLocations() {
  return useQuery<StorageLocation[]>({
    queryKey: LOCATION_KEYS.tree,
    queryFn: () => storageLocationsApi.tree().then((response) => response.data),
  })
}

/**
 * @param deep whether what is inside this place counts too. ⚠️ Part of the key, or switching the toggle
 *             shows the previous answer under the new label
 */
export function useLocationContents(locationId: string | undefined, deep = false) {
  return useQuery<LocationItem[]>({
    queryKey: [...LOCATION_KEYS.contents(locationId ?? ""), deep],
    queryFn: () => storageLocationsApi.contents(locationId!, deep).then((response) => response.data),
    enabled: Boolean(locationId),
  })
}

/**
 * ⚠️ **Every write invalidates the whole tree, and that is not laziness.** A location carries the count
 * of what is filed in it and a path built from its ancestors — so moving one node changes the path of
 * everything beneath it and the count of two others. Refreshing one node would leave the rest lying.
 */
function useLocationMutation<Variables, Result>(send: (variables: Variables) => Promise<Result>) {
  const queryClient = useQueryClient()

  return useMutation<Result, unknown, Variables>({
    mutationFn: send,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LOCATION_KEYS.tree }),
  })
}

export function useCreateLocation() {
  return useLocationMutation((payload: Parameters<typeof storageLocationsApi.create>[0]) =>
    storageLocationsApi.create(payload).then((response) => response.data),
  )
}

export function useUpdateLocation() {
  return useLocationMutation(
    ({ locationId, ...payload }: { locationId: string } & Parameters<typeof storageLocationsApi.update>[1]) =>
      storageLocationsApi.update(locationId, payload).then((response) => response.data),
  )
}

export function useDeleteLocation() {
  return useLocationMutation((locationId: string) =>
    storageLocationsApi.delete(locationId).then(() => undefined),
  )
}

// ── Where one thing is ───────────────────────────────────────────────────────

export function useWhereIs(entryId: string | undefined) {
  return useQuery<EntryLocation | null>({
    queryKey: LOCATION_KEYS.whereIs(entryId ?? ""),
    queryFn: () => storageLocationsApi.whereIs(entryId!).then((response) => response.data),
    enabled: Boolean(entryId),
  })
}

function useAssignmentMutation<Variables extends { entryId: string }, Result>(
  send: (variables: Variables) => Promise<Result>,
) {
  const queryClient = useQueryClient()

  return useMutation<Result, unknown, Variables>({
    mutationFn: send,
    // ⚠️ Both the entry's own answer and the tree: putting something in a drawer changes that drawer's
    // count and empties whichever one it came out of.
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: LOCATION_KEYS.whereIs(variables.entryId) })
      queryClient.invalidateQueries({ queryKey: LOCATION_KEYS.tree })
    },
  })
}

export function useAssignLocation() {
  return useAssignmentMutation(({ entryId, locationId }: { entryId: string; locationId: string }) =>
    storageLocationsApi.assign(entryId, locationId).then((response) => response.data),
  )
}

export function useUnassignLocation() {
  return useAssignmentMutation(({ entryId }: { entryId: string }) =>
    storageLocationsApi.unassign(entryId).then(() => undefined),
  )
}
