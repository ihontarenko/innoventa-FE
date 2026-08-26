import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  pagesApi,
  type CreatePagePayload,
  type PageDetail,
  type PageLink,
  type PageLinkTargetType,
  type PageSummary,
  type PageVisibility,
  type UpdatePagePayload,
} from "@/api/pages"

/**
 * Pages, from this product's own store.
 *
 * ⚠️ **A page belongs to a person and reaches a workspace by being shared into one**, so nothing here
 * is keyed by the active workspace — the server scopes the listing from the request's own context, and
 * a key that named the workspace would cache the same page under several names.
 *
 * ⚠️ **Every mutation invalidates the list as well as the page.** A title, a folder, a visibility and a
 * status all show on the card; a hook that refreshed only the document would leave the grid saying
 * something the page has stopped being.
 */
const PAGE_KEYS = {
  all: ["pages"] as const,
  // ⚠️ Not keyed by folder or search term, because the listing is not fetched per folder or per term —
  // one answer is filtered in the browser. A key carrying arguments nothing varies is a cache split
  // waiting to happen the day somebody passes one.
  list: ["pages", "list"] as const,
  detail: (pageId: string) => ["pages", "detail", pageId] as const,
  links: (pageId: string) => ["pages", "links", pageId] as const,
  backlinks: (targetType: string, targetId: string) => ["pages", "backlinks", targetType, targetId] as const,
}

/**
 * Every page this reader can see.
 *
 * ⚠️ Filtering by folder and by text is done **here, in the browser** on the full list — the same as the
 * screen this replaces. The server accepts both as parameters, but re-fetching per keystroke would make
 * a search that is instant today wait on a round trip, for a listing that is small by construction.
 */
export function usePages() {
  return useQuery<PageSummary[]>({
    queryKey: PAGE_KEYS.list,
    queryFn: () => pagesApi.list().then((response) => response.data),
    staleTime: 30_000,
  })
}

export function usePage(pageId: string | undefined) {
  return useQuery<PageDetail>({
    queryKey: PAGE_KEYS.detail(pageId ?? ""),
    queryFn: () => pagesApi.get(pageId!).then((response) => response.data),
    enabled: Boolean(pageId),
  })
}

export function usePageLinks(pageId: string | undefined) {
  return useQuery<PageLink[]>({
    queryKey: PAGE_KEYS.links(pageId ?? ""),
    queryFn: () => pagesApi.links(pageId!).then((response) => response.data),
    enabled: Boolean(pageId),
  })
}

/** Which pages document this entry or project — read on the entry's own screen, not on a page's. */
export function usePageBacklinks(targetType: PageLinkTargetType, targetId: string | undefined) {
  return useQuery<PageSummary[]>({
    queryKey: PAGE_KEYS.backlinks(targetType, targetId ?? ""),
    queryFn: () => pagesApi.backlinks(targetType, targetId!).then((response) => response.data),
    enabled: Boolean(targetId),
  })
}

/**
 * ⚠️ **Invalidates `["pages"]` whole, not a narrower key.** A page's folder is part of what the folder
 * counts say, and a page moved between folders changes two lists and a rail at once; anything more
 * precise here would be a rule to keep in step with every future mutation.
 */
function usePageMutation<Variables, Result>(send: (variables: Variables) => Promise<Result>) {
  const queryClient = useQueryClient()

  return useMutation<Result, unknown, Variables>({
    mutationFn: send,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAGE_KEYS.all })
      queryClient.invalidateQueries({ queryKey: ["folders"] })
    },
  })
}

export function useCreatePage() {
  return usePageMutation((payload: CreatePagePayload) => pagesApi.create(payload).then((response) => response.data))
}

export function useUpdatePage() {
  return usePageMutation((variables: { pageId: string; payload: UpdatePagePayload }) =>
    pagesApi.update(variables.pageId, variables.payload).then((response) => response.data),
  )
}

export function useUploadPage() {
  return usePageMutation((variables: { file: File; categoryId?: string }) =>
    pagesApi.upload(variables.file, variables.categoryId).then((response) => response.data),
  )
}

export function useSetPageVisibility() {
  return usePageMutation((variables: { pageId: string; visibility: PageVisibility }) =>
    pagesApi.setVisibility(variables.pageId, variables.visibility).then((response) => response.data),
  )
}

/** ⚠️ Sends the whole set of workspaces, never the difference — see `pagesApi.setShares`. */
export function useSetPageShares() {
  return usePageMutation((variables: { pageId: string; spaceIds: string[] }) =>
    pagesApi.setShares(variables.pageId, variables.spaceIds).then((response) => response.data),
  )
}

export function useDeletePage() {
  return usePageMutation((pageId: string) => pagesApi.delete(pageId).then((response) => response.data))
}

export function useAttachPageLink() {
  return usePageMutation((variables: { pageId: string; targetType: PageLinkTargetType; targetId: string }) =>
    pagesApi
      .attachLink(variables.pageId, variables.targetType, variables.targetId)
      .then((response) => response.data),
  )
}

export function useDetachPageLink() {
  return usePageMutation((variables: { pageId: string; targetType: PageLinkTargetType; targetId: string }) =>
    pagesApi
      .detachLink(variables.pageId, variables.targetType, variables.targetId)
      .then((response) => response.data),
  )
}
