import { useMutation, useQuery } from "@tanstack/react-query"
import { publicEntryApi, publicFileApi, publicFormsApi, type PublicFileMeta } from "@/api/public"
import type { FormDetail, FormEntry } from "@/types"

/**
 * ⚠️ **`retry: 1` on every read here, and no more.** A dead or revoked link answers 404 immediately and
 * correctly; retrying it three times makes a visitor wait to be told the same thing, on the one surface
 * where the visitor has no idea what is going on and no way to ask.
 */
export function usePublicForm(shareToken: string | undefined) {
  return useQuery<FormDetail>({
    queryKey: ["public-form", shareToken],
    queryFn: () => publicFormsApi.getForm(shareToken!).then((response) => response.data),
    enabled: !!shareToken,
    retry: 1,
  })
}

export function useSubmitPublicEntry() {
  return useMutation({
    mutationFn: ({ shareToken, fieldValues }: { shareToken: string; fieldValues: Record<string, string> }) =>
      publicFormsApi.submitEntry(shareToken, fieldValues).then((response) => response.data),
  })
}

export function usePublicEntry(shareToken: string | undefined) {
  return useQuery<FormEntry>({
    queryKey: ["public-entry", shareToken],
    queryFn: () => publicEntryApi.get(shareToken!).then((response) => response.data),
    enabled: !!shareToken,
    staleTime: 60_000,
    retry: 1,
  })
}

export function usePublicEntryForm(shareToken: string | undefined) {
  return useQuery<FormDetail>({
    queryKey: ["public-entry-form", shareToken],
    queryFn: () => publicEntryApi.getForm(shareToken!).then((response) => response.data),
    enabled: !!shareToken,
    staleTime: 5 * 60_000,
    retry: 1,
  })
}

export function usePublicFile(viewToken: string | undefined) {
  return useQuery<PublicFileMeta>({
    queryKey: ["public-file", viewToken],
    queryFn: () => publicFileApi.meta(viewToken!).then((response) => response.data),
    enabled: !!viewToken,
    staleTime: 5 * 60_000,
    retry: 1,
  })
}
