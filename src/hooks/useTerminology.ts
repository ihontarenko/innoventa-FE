import { useCallback } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { terminologyApi, type Terminology } from "@/api/terminology"
import { useSpaceStore } from "@/stores/spaceStore"

/**
 * The words this workspace uses.
 *
 * ⚠️ **Cached for a long time on purpose.** A vocabulary changes when somebody edits it on a settings
 * screen, which invalidates this key directly — refetching it every thirty seconds would put a request
 * behind every screen in the product to catch an edit that happens twice a year.
 */
export function useTerminology() {
  const spaceId = useSpaceStore((store) => store.activeSpaceId)

  return useQuery<Terminology>({
    queryKey: ["terminology", spaceId],
    queryFn: () => terminologyApi.words(spaceId!).then((response) => response.data),
    enabled: Boolean(spaceId),
    staleTime: 10 * 60_000,
  })
}

/**
 * `term("thing.many", "things")` — this workspace's word, or the English the screen already had.
 *
 * ⚠️ **The fallback is required and is never the key.** A screen rendering `thing.many` because a row was
 * deleted, or because the words have not arrived yet, reads as a broken product; the English reads as
 * English. That is also why this works before the query resolves — the first paint is correct rather than
 * blank, and the words replace it when they land.
 *
 * ⚠️ **Capitalisation is the caller's.** A term is stored as it is written — «прилад», not «Прилад» —
 * because a noun appears mid-sentence far more often than at the start of one, and a layer that
 * capitalised for you would be unfixable in the sentences where it is wrong.
 */
export function useTerm() {
  const { data } = useTerminology()

  return useCallback(
    (key: string, fallback: string) => data?.words?.[key] ?? fallback,
    [data],
  )
}

export function useRenameTerms() {
  const queryClient = useQueryClient()
  const spaceId = useSpaceStore((store) => store.activeSpaceId)

  return useMutation({
    mutationFn: (wanted: Record<string, string>) =>
      terminologyApi.rename(spaceId!, wanted).then((response) => response.data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["terminology"] })
      // ⚠️ The menu carries renamed labels too, and it is served rather than composed in the browser —
      // so a rename that did not invalidate it would change every screen except the one somebody is
      // looking at while they rename.
      await queryClient.invalidateQueries({ queryKey: ["spaces"] })
    },
  })
}

/** Title case for a term used to open a sentence or a heading. */
export function capitalised(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}
