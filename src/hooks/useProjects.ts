import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { projectsApi, type ProjectDetail, type ProjectSummary } from "@/api/projects"
import type { Page } from "@/api/forms"
import { useSpaceStore } from "@/stores/spaceStore"

const PROJECT_KEYS = {
  all: ["projects"] as const,
  one: (projectId: string) => ["projects", projectId] as const,
}

export function useProjects(page = 0, size = 25) {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  return useQuery<Page<ProjectSummary>>({
    queryKey: [...PROJECT_KEYS.all, spaceId, page, size],
    queryFn: () => projectsApi.list(spaceId ?? undefined, page, size).then((response) => response.data),
    placeholderData: keepPreviousData,
  })
}

export function useProject(projectId: string | undefined) {
  return useQuery<ProjectDetail>({
    queryKey: PROJECT_KEYS.one(projectId ?? ""),
    queryFn: () => projectsApi.get(projectId!).then((response) => response.data),
    enabled: Boolean(projectId),
  })
}

function useProjectMutation<Variables, Result>(send: (variables: Variables) => Promise<Result>) {
  const queryClient = useQueryClient()

  return useMutation<Result, unknown, Variables>({
    mutationFn: send,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.all }),
  })
}

export function useCreateProject() {
  return useProjectMutation((payload: Parameters<typeof projectsApi.create>[0]) =>
    projectsApi.create(payload).then((response) => response.data),
  )
}

export function useUpdateProject() {
  return useProjectMutation(
    ({ projectId, ...payload }: { projectId: string } & Parameters<typeof projectsApi.update>[1]) =>
      projectsApi.update(projectId, payload).then((response) => response.data),
  )
}

export function useDeleteProject() {
  return useProjectMutation((projectId: string) => projectsApi.delete(projectId).then(() => undefined))
}

/**
 * ⚠️ **Every material write refetches the *whole project*, and that is deliberate.** Reserving stock on
 * one line changes `availableQuantity` on every other line sitting on the same drawer, and it changes
 * `buildability` — which is derived from all of them. Patching one row into the cache would leave a
 * screen whose "3 buildable" no longer matches the rows under it, and nothing would ever correct it.
 */
function useMaterialMutation<Variables extends { projectId: string }, Result>(
  send: (variables: Variables) => Promise<Result>,
) {
  const queryClient = useQueryClient()

  return useMutation<Result, unknown, Variables>({
    mutationFn: send,
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.one(variables.projectId) })
      // The list carries the coverage counts, so it is stale too.
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.all })
    },
  })
}

export function useAddMaterial() {
  return useMaterialMutation(
    ({ projectId, ...payload }: { projectId: string } & Parameters<typeof projectsApi.addMaterial>[1]) =>
      projectsApi.addMaterial(projectId, payload).then((response) => response.data),
  )
}

export function useUpdateMaterial() {
  return useMaterialMutation(
    ({
      projectId,
      materialId,
      ...payload
    }: { projectId: string; materialId: string } & Parameters<typeof projectsApi.updateMaterial>[2]) =>
      projectsApi.updateMaterial(projectId, materialId, payload).then((response) => response.data),
  )
}

export function useDeleteMaterial() {
  return useMaterialMutation(({ projectId, materialId }: { projectId: string; materialId: string }) =>
    projectsApi.deleteMaterial(projectId, materialId).then(() => undefined),
  )
}

export function useToggleMaterialExcluded() {
  return useMaterialMutation(({ projectId, materialId }: { projectId: string; materialId: string }) =>
    projectsApi.toggleExcluded(projectId, materialId).then((response) => response.data),
  )
}

export function useLinkStockEntry() {
  return useMaterialMutation(
    ({ projectId, materialId, stockEntryId }: { projectId: string; materialId: string; stockEntryId: string }) =>
      projectsApi.linkStockEntry(projectId, materialId, stockEntryId).then((response) => response.data),
  )
}

export function useUnlinkStockEntry() {
  return useMaterialMutation(({ projectId, materialId }: { projectId: string; materialId: string }) =>
    projectsApi.unlinkStockEntry(projectId, materialId).then((response) => response.data),
  )
}

export function useLinkCatalogEntry() {
  return useMaterialMutation(
    ({
      projectId,
      materialId,
      catalogEntryId,
    }: {
      projectId: string
      materialId: string
      catalogEntryId: string
    }) => projectsApi.linkCatalogEntry(projectId, materialId, catalogEntryId).then((response) => response.data),
  )
}

export function useUnlinkCatalogEntry() {
  return useMaterialMutation(({ projectId, materialId }: { projectId: string; materialId: string }) =>
    projectsApi.unlinkCatalogEntry(projectId, materialId).then((response) => response.data),
  )
}

export function useReserveStock() {
  return useMaterialMutation(
    ({ projectId, materialId, quantity }: { projectId: string; materialId: string; quantity: number }) =>
      projectsApi.reserveStock(projectId, materialId, quantity).then((response) => response.data),
  )
}

export function useReleaseStock() {
  return useMaterialMutation(({ projectId, materialId }: { projectId: string; materialId: string }) =>
    projectsApi.releaseStock(projectId, materialId).then((response) => response.data),
  )
}

export function useImportBom() {
  return useMaterialMutation(
    ({ projectId, provider, file }: { projectId: string; provider: string; file: File }) =>
      projectsApi.importBom(projectId, provider, file).then((response) => response.data),
  )
}
