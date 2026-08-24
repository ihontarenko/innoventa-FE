import { http } from "./http"

/**
 * The generic, owner-scoped folder tree.
 *
 * ⚠️ **Mounted at `/folders`, not `/categories`** — the second belongs to the form library, and the
 * two trees have nothing to do with each other. A form's category is a heading under a purpose; this is
 * a folder somebody files a document into.
 *
 * ⚠️ **Files only, since INVT-0099.** The tree used to hold pages as well, and sharing a folder
 * published that subtree publicly. Pages are Kiwi's now and it does its own sharing under its own
 * grants, so the share was deleted rather than left minting tokens that resolve to nothing.
 */

/**
 * The kinds of thing filed into a {@link Category}.
 *
 * ⚠️ **`PAGE` is gone** — this product files no pages any more (INVT-0099).
 */
export type CategoryEntityType = "FILE"

/** A folder in the shared, owner-scoped tree. ⚠️ Arrives in nested-set order — the list *is* the tree. */
export interface Category {
  id: string
  parentId: string | null
  name: string
  slug: string
  icon: string | null
  depth: number
  sortOrder: number
  shareToken: string | null
}

export const foldersApi = {
  list: () => http.get<Category[]>("/folders"),

  /** ⚠️ Empty folders are omitted — read a missing key as zero rather than as unknown. */
  counts: (entityType: CategoryEntityType) =>
    http.get<Record<string, number>>("/folders/counts", { params: { entityType } }),

  create: (payload: { parentId?: string | null; name: string; icon?: string }) =>
    http.post<Category[]>("/folders", payload),

  /** ⚠️ Answers with the whole tree, because removing a folder renumbers the nested set. */
  delete: (categoryId: string) => http.delete<Category[]>(`/folders/${categoryId}`),

}

