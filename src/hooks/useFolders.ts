import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { foldersApi, type Category, type CategoryEntityType } from "@/api/folders"

/**
 * The owner-scoped folder tree.
 *
 * ⚠️ **A folder belongs to its owner, not to a workspace** — which is why nothing here is keyed by the
 * active workspace, and why switching workspace does not refetch.
 *
 * ⚠️ **Files only, since INVT-0099** — pages left this product for Kiwi, and folder sharing left with
 * them rather than staying to mint tokens that resolve to nothing.
 */
const FOLDER_KEYS = {
  all: ["folders"] as const,
  counts: (entityType: string) => ["folders", "counts", entityType] as const,
}

export function useFolders() {
  return useQuery<Category[]>({
    queryKey: FOLDER_KEYS.all,
    queryFn: () => foldersApi.list().then((response) => response.data),
    staleTime: 60_000,
  })
}

/** ⚠️ Empty folders are omitted — read a missing key as zero rather than as unknown. */
export function useFolderCounts(entityType: CategoryEntityType) {
  return useQuery<Record<string, number>>({
    queryKey: FOLDER_KEYS.counts(entityType),
    queryFn: () => foldersApi.counts(entityType).then((response) => response.data),
    staleTime: 60_000,
  })
}

function useFolderMutation<Variables, Result>(send: (variables: Variables) => Promise<Result>) {
  const queryClient = useQueryClient()

  return useMutation<Result, unknown, Variables>({
    mutationFn: send,
    // ⚠️ The tree *and* the counts. A removed folder renumbers the nested set and moves whatever was
    // filed under it, so a screen that refreshed one of them would draw a tree with wrong numbers.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FOLDER_KEYS.all }),
  })
}

export function useCreateFolder() {
  return useFolderMutation((payload: Parameters<typeof foldersApi.create>[0]) =>
    foldersApi.create(payload).then((response) => response.data),
  )
}

export function useDeleteFolder() {
  return useFolderMutation((categoryId: string) => foldersApi.delete(categoryId).then((response) => response.data))
}
