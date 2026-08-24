import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiErrorMessage } from "@/api/kiwiErrors"
import { isKiwiUnreachable } from "@/api/kiwiClient"
import {
  createKiwiPage,
  deleteKiwiPage,
  fileKiwiPage,
  findKiwiSection,
  getKiwiPage,
  getKiwiPagesIn,
  getKiwiTree,
  isInsideSubtree,
  searchKiwiPages,
  updateKiwiPage,
  type KiwiCategoryNode,
  type KiwiPageSummary,
} from "@/api/kiwi"

/**
 * Everything the Wiki tab reads and writes — **all of it in Kiwi** (INVT-0121, INVT-0121).
 *
 * <h2>⚠️ Innoventa's backend is not on this path at all</h2>
 *
 * Not a proxy, not a relay, not a cache. The browser calls Kiwi directly carrying the reader's own
 * Identity token (KW-1 §1), which is the whole reason Kiwi can be the **only** authority over who may
 * read a page: it sees the person, not a product. A consumer that fetched pages through its own
 * backend would be a second authority, and two authorities cannot guarantee that deny wins.
 *
 * <h2>⚠️ There is no `staleTime`, and that is the point</h2>
 *
 * KW-1 §12, and the decisive argument is not simplicity: `@CATEGORY` grants are checked on every read,
 * so **a cached page keeps rendering after somebody's access has been taken away.**
 *
 * <h2>⚠️ No `retry`, either</h2>
 *
 * Kiwi being down should cost one tab and one honest sentence, not a screen that hangs while it tries
 * three times. Which of the two a failure is — unreachable, or Kiwi answering "not yours" — is
 * {@link isKiwiUnreachable}'s question, and the screen asks it.
 */
export function useKiwiWiki(rootCategoryId: string | null, search: string, sectionId: string | null) {
  const queryClient = useQueryClient()

  const tree = useQuery({
    queryKey: ["kiwi-tree"],
    queryFn: getKiwiTree,
    enabled: rootCategoryId !== null,
    retry: false,
  })

  /**
   * The project's own branch of Kiwi's tree.
   *
   * ⚠️ **Null has two meanings and the screen must tell them apart**: the tree has not arrived yet, or
   * it arrived and this reader cannot see the configured root — which is Kiwi answering honestly about
   * a grant, not a fault.
   */
  const root: KiwiCategoryNode | null =
    rootCategoryId === null || !tree.data ? null : findKiwiSection(tree.data, rootCategoryId)

  return {
    tree,
    root,
    rootMissing: tree.isSuccess && rootCategoryId !== null && root === null,
    unreachable: tree.isError && isKiwiUnreachable(tree.error),
    // ⚠️ The SELECTED section, falling back to the root — not the root alone, which is what this was
    // ported as. A root is routinely a heading whose pages are one level down (the imported manual is
    // exactly that), and listing only its direct pages made every chapter open on an empty pane while
    // the tree beside it showed a count. The count was right; the list was asking the wrong section.
    ...usePagesOf(findKiwiSection(tree.data ?? [], sectionId ?? "") ?? root, search, root),
    ...useWrites(queryClient),
  }
}

/**
 * A section's pages, or a search across the project's branch.
 *
 * ⚠️ **Two different reads behind one name, because the screen shows one list.** Browsing asks Kiwi for
 * a section's contents; searching asks Kiwi's whole-tree search and **filters the answer to the
 * project's branch here** — Kiwi has nowhere in the request to say "only under this section", and a
 * page filed elsewhere is not this project's wiki even when the same person may read both.
 */
function usePagesOf(section: KiwiCategoryNode | null, search: string, root: KiwiCategoryNode | null) {
  const browsing = useQuery({
    queryKey: ["kiwi-pages", section?.id],
    queryFn: () => getKiwiPagesIn(section!.id),
    enabled: section !== null && search.trim() === "",
    retry: false,
  })

  // ⚠️ Search spans the whole BRANCH, not the open section. Somebody searching has stopped browsing;
  // narrowing to wherever they happened to be standing would hide the answer they asked for.
  const searching = useQuery({
    queryKey: ["kiwi-search", root?.id, search],
    queryFn: () =>
      searchKiwiPages(search.trim()).then((found) =>
        found.filter((page) => isInsideSubtree(root!, page.categoryId)),
      ),
    enabled: root !== null && search.trim() !== "",
    retry: false,
  })

  const active = search.trim() === "" ? browsing : searching

  return {
    pages: (active.data ?? []) as KiwiPageSummary[],
    pagesLoading: active.isLoading,
    pagesError: active.error,
    isSearching: search.trim() !== "",
  }
}

/**
 * Writing.
 *
 * ⚠️ **Every refusal is shown rather than swallowed.** Innoventa holds no opinion about who may write a
 * page — Kiwi does, per section, through its own grants — so the interface offers the control and
 * repeats the answer. Hiding a button on a guess would mean reproducing Kiwi's rules here, badly, and
 * the first time the two disagreed the wrong one would be the one nobody could see.
 */
function useWrites(queryClient: ReturnType<typeof useQueryClient>) {
  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["kiwi-tree"] })
    queryClient.invalidateQueries({ queryKey: ["kiwi-pages"] })
    queryClient.invalidateQueries({ queryKey: ["kiwi-search"] })
  }

  const addPage = useMutation({
    mutationFn: ({ categoryId, title }: { categoryId: string; title: string }) =>
      createKiwiPage(categoryId, title, ""),
    onSuccess: (page) => {
      refresh()
      toast.success(`“${page.title}” created`)
    },
    onError: (error) => toast.error(kiwiErrorMessage(error, "Could not create the page")),
  })

  const savePage = useMutation({
    mutationFn: ({ pageId, title, markdown }: { pageId: string; title: string; markdown: string }) =>
      updateKiwiPage(pageId, title, markdown),
    onSuccess: (page) => {
      queryClient.setQueryData(["kiwi-page", page.id], page)
      refresh()
      toast.success("Saved")
    },
    onError: (error) => toast.error(kiwiErrorMessage(error, "Could not save the page")),
  })

  const filePage = useMutation({
    mutationFn: ({ pageId, categoryId }: { pageId: string; categoryId: string }) =>
      fileKiwiPage(pageId, categoryId),
    onSuccess: (page) => {
      queryClient.setQueryData(["kiwi-page", page.id], page)
      refresh()
    },
    onError: (error) => toast.error(kiwiErrorMessage(error, "Could not move the page")),
  })

  const removePage = useMutation({
    mutationFn: (pageId: string) => deleteKiwiPage(pageId),
    onSuccess: () => {
      refresh()
      toast.success("Page deleted")
    },
    onError: (error) => toast.error(kiwiErrorMessage(error, "Could not delete the page")),
  })

  return { addPage, savePage, filePage, removePage }
}

/**
 * One page in full.
 *
 * ⚠️ Its own query rather than a lookup in the list, because a list deliberately does not carry
 * `contentMarkdown` — an index that shipped every document would send the whole wiki to draw a sidebar.
 */
export function useKiwiPage(pageId: string | null) {
  return useQuery({
    queryKey: ["kiwi-page", pageId],
    queryFn: () => getKiwiPage(pageId as string),
    enabled: pageId !== null,
    retry: false,
  })
}

/**
 * ⚠️ **A failure here is another product's, and saying so is not pedantry.** "Could not save the page"
 * beside a Innoventa screen reads as Innoventa being broken; the reader needs to know the wiki lives
 * somewhere else before they go looking for their text in the wrong place.
 */
function kiwiErrorMessage(error: unknown, fallback: string): string {
  if (isKiwiUnreachable(error)) {
    return `${fallback} — Kiwi is down or unreachable.`
  }

  return apiErrorMessage(error, fallback)
}
