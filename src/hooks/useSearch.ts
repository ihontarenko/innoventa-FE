import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { searchApi, type SearchHit, type SearchTypeDescriptor } from "@/api/search"
import type { Page } from "@/api/forms"
import { useSpaceStore } from "@/stores/spaceStore"

/**
 * ⚠️ **Two characters, and the reason is the index rather than politeness.** A single letter matches
 * most of what anybody owns, so the answer is both useless and the most expensive one the server can
 * compute — the screen says so instead of running it.
 */
export const MINIMUM_QUERY_LENGTH = 2

export function useSearchTypes() {
  return useQuery<SearchTypeDescriptor[]>({
    queryKey: ["search", "types"],
    queryFn: () => searchApi.types().then((response) => response.data),
    staleTime: 5 * 60_000,
  })
}

export function useSearch(query: string, types: string[] | undefined, page = 0) {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  return useQuery<Page<SearchHit>>({
    queryKey: ["search", query, spaceId, types?.join(",") ?? "", page],
    queryFn: () =>
      searchApi.search(query, spaceId ?? undefined, types, page).then((response) => response.data),
    enabled: query.trim().length >= MINIMUM_QUERY_LENGTH,
    // ⚠️ The previous page stays on screen while the next loads. A results list that blanks between
    // pages loses the reader's place on every step.
    placeholderData: keepPreviousData,
  })
}
