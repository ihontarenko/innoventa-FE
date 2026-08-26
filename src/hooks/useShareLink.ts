import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { shareApi } from "@/api/files"

/**
 * What kind of thing is being shared.
 *
 * ⚠️ **The routes are general and the permissions are not.** `/api/share/{entityType}/{entityId}` serves
 * a file, an entry, a page and a form through one mechanism — but `ShareTokenController` gates the read
 * on `file:read` and both writes on `file:private`, because the three routes were lifted off the file
 * controller when it was deleted and their annotations came with them. So sharing a *record* today costs
 * a file permission. That is a backend decision to revisit, not something an interface may work around.
 */
export type ShareEntityType = "FILE" | "ENTRY" | "FORM" | "PAGE"

const SHARE_KEY = (entityType: ShareEntityType, entityId: string) =>
  ["share-token", entityType, entityId] as const

/**
 * The public token one resource has, if it has one.
 *
 * ⚠️ **Asked through the BATCH route with one id, because there is no single-resource read.** The
 * endpoint answers a map and omits anything unshared — "has no public link" and "is not in the answer"
 * are the same fact there, so an absent key becomes `null` here rather than being treated as a failure.
 */
export function useShareToken(entityType: ShareEntityType, entityId: string | undefined) {
  return useQuery<string | null>({
    queryKey: SHARE_KEY(entityType, entityId ?? ""),
    queryFn: () =>
      shareApi
        .tokens(entityType, [entityId!])
        .then((response) => response.data[entityId!] ?? null),
    enabled: !!entityId,
    staleTime: 30_000,
  })
}

function useShareMutation<TArguments extends { entityType: ShareEntityType; entityId: string }>(
  run: (argument: TArguments) => Promise<unknown>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: run,
    onSuccess: (_result, argument) => {
      void queryClient.invalidateQueries({ queryKey: SHARE_KEY(argument.entityType, argument.entityId) })

      /* ⚠️ The listing carries the link on every row (`withLinks`), so a link minted on one record's
         screen has to reach the table behind it — otherwise the row still says *not shared* until
         somebody reloads, and the two disagree in front of the person who just pressed the button. */
      void queryClient.invalidateQueries({ queryKey: ["files"] })
      void queryClient.invalidateQueries({ queryKey: ["entries"] })
    },
  })
}

/**
 * Mint the public link, or replace one that got out.
 *
 * ⚠️ **One route does both, and the wording has to say which happened.** `rotate` creates a link where
 * there is none and *invalidates the old one* where there is — the second is destructive to anybody
 * holding the previous address, so a control that said only "Share" would quietly break every link
 * already handed out.
 */
export function useRotateShare() {
  return useShareMutation(({ entityType, entityId }: { entityType: ShareEntityType; entityId: string }) =>
    shareApi.rotate(entityType, entityId).then((response) => response.data),
  )
}

export function useRevokeShare() {
  return useShareMutation(({ entityType, entityId }: { entityType: ShareEntityType; entityId: string }) =>
    shareApi.revoke(entityType, entityId),
  )
}

/**
 * Where a shared thing is read, by kind.
 *
 * ⚠️ **A file's public page is the VIEWER, not the bytes.** `/_/file/{token}` serves the file itself and
 * is what an `<img>` or an embed points at; handing a person that address drops them into a raw PDF with
 * no way back. The address somebody is *given* is the branded page.
 */
export function publicAddressOf(entityType: ShareEntityType, token: string): string {
  const path = {
    FILE: `/_/viewer/${token}`,
    ENTRY: `/_/entry/${token}`,
    FORM: `/_/form/${token}`,
    PAGE: `/_/page/${token}`,
  }[entityType]

  return `${window.location.origin}${path}`
}
