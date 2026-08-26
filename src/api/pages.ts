import { http } from "./http"

/**
 * Pages — Markdown documents, stored by **this** product.
 *
 * ⚠️ **A page belongs to a person, not to a workspace.** `ownerUserId` is what it carries; a workspace
 * sees it because it was *shared into* one, through `sharedSpaceIds`, the same way a form reaches a
 * workspace. That is why nothing here takes a workspace id: the listing is scoped by the active
 * workspace on the server, from the context the request already carries.
 *
 * ⚠️ **Which folder a page is in belongs to the folder tree, not to the page.** It arrives on the page
 * as `categoryId` for convenience, and it is written through the page's own update — but the tree
 * itself is `api/folders.ts`, and it is shared with nothing else now that files have their own.
 */

/** `PUBLIC` means reachable by anybody holding the share link — not "everyone in the workspace". */
export type PageVisibility = "PRIVATE" | "PUBLIC"

export type PageStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED"

/**
 * How a page is set — a typographic decision, not a content one.
 *
 * ⚠️ **It changes the reading, never the markdown.** The same source renders as a datasheet, an essay
 * or a dense reference; a style that rewrote content would make the source and the page two different
 * documents. `api/blocks.ts` re-exports this, because that is where every renderer imports it from.
 */
export type PageRenderStyle = "REGULAR" | "TECHNICAL" | "EDITORIAL" | "COMPACT" | "ACADEMIC"

/** What a page can be attached to. Polymorphic and deliberately narrow — see `page_links`. */
export type PageLinkTargetType = "ENTRY" | "PROJECT"

/**
 * A page as a list draws it: everything but the document.
 *
 * ⚠️ Every optional field arrives as **`undefined`, never `null`** — the backend serialises non-null —
 * so `page.excerpt === null` is silently always false. Test for falsiness, not for null.
 */
export interface PageSummary {
  id: string
  title: string
  slug: string
  excerpt?: string
  categoryId?: string
  visibility: PageVisibility
  status: PageStatus
  renderStyle: PageRenderStyle
  /** Present only while the page is shared; the public address is built from it, never stored. */
  shareToken?: string
  updatedAt: string
}

export interface PageDetail extends PageSummary {
  contentMarkdown: string
  /** The workspaces this page has been shared into. Orthogonal to `visibility`. */
  sharedSpaceIds: string[]
  createdAt: string
}

/** One thing a page documents, resolved to a label — the target itself may since have been deleted. */
export interface PageLink {
  targetType: PageLinkTargetType
  targetId: string
  targetLabel: string
  createdAt: string
}

export interface CreatePagePayload {
  title: string
  categoryId?: string | null
  contentMarkdown?: string
  visibility?: PageVisibility
  renderStyle?: PageRenderStyle
}

export interface UpdatePagePayload {
  title?: string
  categoryId?: string | null
  contentMarkdown?: string
  visibility?: PageVisibility
  status?: PageStatus
  renderStyle?: PageRenderStyle
}

export const pagesApi = {
  list: (parameters?: { categoryId?: string; search?: string }) =>
    http.get<PageSummary[]>("/pages", { params: parameters }),

  get: (pageId: string) => http.get<PageDetail>(`/pages/${pageId}`),

  /** By slug rather than by id — what a human-typed address resolves through. */
  getBySlug: (slug: string) => http.get<PageDetail>(`/pages/slug/${slug}`),

  create: (payload: CreatePagePayload) => http.post<PageDetail>("/pages", payload),

  update: (pageId: string, payload: UpdatePagePayload) => http.put<PageDetail>(`/pages/${pageId}`, payload),

  /**
   * Uploads a `.md` file as a new page.
   *
   * ⚠️ **No `Content-Type` is set, and it must stay that way.** The browser writes the multipart
   * boundary; naming the type by hand produces a request the server cannot split. `http.ts`'s request
   * interceptor knows this — it stamps `application/json` on every body *except* a `FormData` one — so
   * the safety here is that the body really is a `FormData`, not that this call says anything.
   */
  upload: (file: File, categoryId?: string) => {
    const body = new FormData()

    body.append("file", file)

    if (categoryId) {
      body.append("categoryId", categoryId)
    }

    return http.post<PageDetail>("/pages/upload", body)
  },

  /** Publishing and unpublishing. Minting the share link is the server's side of this. */
  setVisibility: (pageId: string, visibility: PageVisibility) =>
    http.put<PageDetail>(`/pages/${pageId}/visibility`, { visibility }),

  /** ⚠️ Replaces the whole set — send every workspace the page should be in, not the difference. */
  setShares: (pageId: string, spaceIds: string[]) =>
    http.put<PageDetail>(`/pages/${pageId}/shares`, { spaceIds }),

  delete: (pageId: string) => http.delete<void>(`/pages/${pageId}`),

  links: (pageId: string) => http.get<PageLink[]>(`/pages/${pageId}/links`),

  /** The other direction: which pages document this entry or project. */
  backlinks: (targetType: PageLinkTargetType, targetId: string) =>
    http.get<PageSummary[]>("/pages/backlinks", { params: { targetType, targetId } }),

  attachLink: (pageId: string, targetType: PageLinkTargetType, targetId: string) =>
    http.post<void>(`/pages/${pageId}/links`, { targetType, targetId }),

  detachLink: (pageId: string, targetType: PageLinkTargetType, targetId: string) =>
    http.delete<void>(`/pages/${pageId}/links`, { params: { targetType, targetId } }),
}

/** The address a shared page is read at. ⚠️ The route literal lives here and nowhere else. */
export function publicPageUrl(shareToken: string): string {
  return `${window.location.origin}/_/page/${shareToken}`
}
