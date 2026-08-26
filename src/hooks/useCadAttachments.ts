import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { cadApi, type CadAttachment } from "@/api/cad"

const CAD_KEY = (entryId: string) => ["entries", entryId, "cad"] as const

/**
 * What this entry is drawn as — or, asked of a drawing, everything that uses it.
 *
 * ⚠️ **One hook for both directions, because it is one question.** A part asking for its footprints and
 * a footprint asking which parts use it read the same rows from opposite ends, and a second hook for the
 * reverse would be a second thing to keep true.
 */
export function useCadAttachments(entryId?: string) {
  return useQuery<CadAttachment[]>({
    queryKey: CAD_KEY(entryId ?? ""),
    queryFn: () => cadApi.attachments(entryId!).then((response) => response.data),
    enabled: Boolean(entryId),
    staleTime: 30_000,
  })
}

/**
 * ⚠️ **Both ends are invalidated, and forgetting the far one is the bug to expect.** Attaching a
 * footprint to a part changes what the *footprint's* screen should say just as much as the part's — and
 * that screen is the one nobody has open at the time, so a stale answer there survives until somebody
 * reloads and quietly disagrees with the other side.
 */
function useCadMutation<TArguments>(
  run: (argument: TArguments) => Promise<unknown>,
  affected: (argument: TArguments) => string[],
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: run,
    onSuccess: (_result, argument) => {
      affected(argument).forEach((entryId) => {
        void queryClient.invalidateQueries({ queryKey: CAD_KEY(entryId) })
      })
    },
  })
}

export function useAttachDrawing() {
  return useCadMutation(
    ({ entryId, drawingEntryId }: { entryId: string; drawingEntryId: string }) =>
      cadApi.attach(entryId, drawingEntryId).then((response) => response.data),
    ({ entryId, drawingEntryId }) => [entryId, drawingEntryId],
  )
}

export function useDetachDrawing() {
  return useCadMutation(
    ({ linkId }: { linkId: string; entryId: string; drawingEntryId: string }) => cadApi.detach(linkId),
    ({ entryId, drawingEntryId }) => [entryId, drawingEntryId],
  )
}
