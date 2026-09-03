import { useQuery } from "@tanstack/react-query"
import { journalApi, type JournalFilter } from "@/api/journal"
import { useSpaceStore } from "@/stores/spaceStore"

/**
 * The workspace register.
 *
 * ⚠️ **The workspace is in the key even though the request does not carry it.** The backend reads the
 * active workspace from the request's own context, so two workspaces answer the same URL with different
 * rows — and a cache keyed without it would hand one workspace's register to the next one opened.
 */
export function useJournal(filter: JournalFilter, page: number, size = 50) {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  return useQuery({
    queryKey: ["journal", spaceId, filter, page, size],
    queryFn: () => journalApi.read(filter, page, size).then((response) => response.data),
    enabled: Boolean(spaceId),
  })
}
