import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { entryLinksApi, type EntryLink } from "@/api/entryLinks"

const LINKS_KEY = (entryId: string) => ["entries", entryId, "links"] as const

/**
 * Everything this record is linked to — **including its drawings**.
 *
 * ⚠️ **The CAD links are in here too, and filtering them out is the caller's job.** The endpoint is the
 * general one and answers every row in the table; a part is attached to its symbol and footprint through
 * the same mechanism as it is to an alternate. A screen that showed all of them would offer a footprint
 * as a part somebody could order instead, and nothing anywhere would refuse it.
 */
export function useEntryLinks(entryId?: string) {
  return useQuery<EntryLink[]>({
    queryKey: LINKS_KEY(entryId ?? ""),
    queryFn: () => entryLinksApi.list(entryId!).then((response) => response.data),
    enabled: Boolean(entryId),
    staleTime: 30_000,
  })
}

/**
 * ⚠️ **Both ends are invalidated, and forgetting the far one is the bug to expect.** Linking two
 * resistors as a pair changes what the *other* resistor's screen should say just as much as this one's —
 * and that screen is the one nobody has open at the time, so a stale answer there survives until
 * somebody reloads and quietly disagrees with the side that was right.
 */
function useLinkMutation<TArguments extends { entryId: string; targetEntryId: string }>(
  run: (argument: TArguments) => Promise<unknown>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: run,
    onSuccess: (_result, argument) => {
      ;[argument.entryId, argument.targetEntryId].forEach((entryId) => {
        void queryClient.invalidateQueries({ queryKey: LINKS_KEY(entryId) })
        /* ⚠️ The CAD panel reads the same rows through its own key — a link written here that it never
           hears about is a footprint that vanishes from one screen and not the other. */
        void queryClient.invalidateQueries({ queryKey: ["entries", entryId, "cad"] })
      })
    },
  })
}

export function useLinkEntries() {
  return useLinkMutation(
    ({ entryId, targetEntryId, label }: { entryId: string; targetEntryId: string; label: string | null }) =>
      entryLinksApi.create(entryId, targetEntryId, label).then((response) => response.data),
  )
}

export function useUnlinkEntries() {
  return useLinkMutation(
    ({ entryId, linkId }: { entryId: string; targetEntryId: string; linkId: string }) =>
      entryLinksApi.remove(entryId, linkId),
  )
}
