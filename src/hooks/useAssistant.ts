import { useMutation, useQuery } from "@tanstack/react-query"
import { assistantApi } from "@/api/assistant"
import type { AssistantAnswer, AssistantAsk, AssistantAvailability } from "@/api/assistant"

/**
 * Whether asking is possible at all, cached for the session.
 *
 * ⚠️ A provider is configuration, changed by restarting the application rather than by anything somebody
 * does on a screen, so this is asked once and kept. Refetching it on every focus would be one request
 * per tab switch to learn the same answer.
 */
export function useAssistantAvailability() {
  return useQuery<AssistantAvailability>({
    queryKey: ["assistant", "availability"],
    queryFn: () => assistantApi.availability().then((response) => response.data),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

/**
 * One turn.
 *
 * ⚠️ **Nothing is invalidated afterwards, and that is not an oversight.** The assistant can change real
 * records, so the caches around it are genuinely stale once it has — but the screen showing them is a
 * different screen, and blanket-invalidating everything on every answer would refetch the whole
 * application to catch the one turn in twenty that wrote something. React Query's own staleness covers
 * the rest, and a person who has just watched the assistant change something is on their way to look
 * at it.
 */
export function useAskAssistant() {
  return useMutation<AssistantAnswer, unknown, AssistantAsk>({
    mutationFn: (payload) => assistantApi.ask(payload).then((response) => response.data),
  })
}
