import { http } from "./http"

/**
 * The generic, owner-scoped folder tree.
 *
 * ⚠️ **Mounted at `/folders`, not `/categories`** — the second belongs to the form library, and the
 * two trees have nothing to do with each other. A form's category is a heading under a purpose; this is
 * a folder somebody files a document into.
 *
 * ⚠️ **Pages only.** Files left for the library's own directory tree, which is a different thing that
 * happens to be drawn as folders too — one tree meaning "somewhere a page lives" and "somewhere bytes
 * live" at once is one tree answering to two access rules.
 *
 * ⚠️ **Folder sharing is not here**, and its absence is deliberate rather than pending. Publishing a
 * subtree to anonymous readers is what the public manual does, and the manual is served by Kiwi through
 * an embed. A share minted here would resolve to nothing.
 */

/**
 * The kinds of thing filed into a {@link Category}.
 *
 * ⚠️ **One value, and the column is still polymorphic.** A second kind is a foreseeable thing to file —
 * a form, a project — and re-introducing a discriminator costs more than keeping one.
 */
export type CategoryEntityType = "PAGE"

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

