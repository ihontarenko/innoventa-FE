import { useQuery } from "@tanstack/react-query"
import { attentionApi, type AttentionGroup } from "@/api/attention"
import { useSpaceStore } from "@/stores/spaceStore"

/**
 * Everything that wants attention in the active workspace.
 *
 * ⚠️ **Not cached hard, and not for the usual reason.** Nothing behind this is stored: a calendar plan
 * falls due with no write anywhere, so a stale answer here can become wrong without anything having
 * happened that would invalidate it. Thirty seconds is short enough that the board is honest and long
 * enough that opening a drawer and coming back does not re-derive the whole workspace.
 */
export function useAttention() {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  return useQuery<AttentionGroup[]>({
    queryKey: ["attention", spaceId],
    queryFn: () => attentionApi.board().then((response) => response.data),
    enabled: Boolean(spaceId),
    staleTime: 30_000,
  })
}
