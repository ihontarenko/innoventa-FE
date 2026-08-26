import { http } from "./http"
import type { PageBlockResponse } from "./blocks"
import type { PageRenderStyle } from "./pages"
import type { FormDetail, FormEntry } from "@/types"

/**
 * What somebody with no account at all can reach.
 *
 * ⚠️ **A share token IS the authorisation.** There is no header, no workspace and no permission on any of
 * these — holding the link is the whole of what the backend checks, which is why the tokens are long and
 * why revoking one is the only way to take access back. `http.ts` knows not to attempt a token refresh on
 * a 401 from here: a visitor with no session must see the resource's own answer, not a sign-in page.
 */
/** A published page, as a stranger holding its link receives it: the document and nothing around it. */
export interface PublicPage {
  title: string
  contentMarkdown: string
  renderStyle: PageRenderStyle
  updatedAt: string
}

export const publicPagesApi = {
  get: (shareToken: string) => http.get<PublicPage>(`/public/pages/${shareToken}`),

  /**
   * The page's live `:::` directives, resolved for a visitor.
   *
   * ⚠️ **Only the public-safe subset answers; the rest come back RESTRICTED** — visibly, never as
   * silence, so a reader can tell a redacted number from a missing one.
   *
   * ⚠️ **Addressed by the share token, not by a page id.** The token is the authorisation, and this
   * request cannot lean on the one that fetched the document — a public endpoint accepting an id would
   * read any page's live data for anybody who could guess one.
   */
  resolveBlocks: (shareToken: string, blocks: Array<{ name: string; argument: string }>) =>
    http.post<PageBlockResponse[]>(`/public/pages/${shareToken}/blocks/resolve`, blocks),
}

export const publicFormsApi = {
  getForm: (shareToken: string) => http.get<FormDetail>(`/public/forms/${shareToken}`),

  submitEntry: (shareToken: string, fieldValues: Record<string, string>) =>
    http.post<FormEntry>(`/public/forms/${shareToken}/entries`, { fieldValues }),
}

export const publicEntryApi = {
  get: (shareToken: string) => http.get<FormEntry>(`/public/entries/${shareToken}`),

  /**
   * ⚠️ **A second call, and it cannot be avoided.** A row is a map of field *names* to written values;
   * without the form that shaped it there are no labels, no order and no units — only keys. The two are
   * fetched separately because they are cached separately: a shared entry is read once, its form is read
   * by every entry that shares it.
   */
  getForm: (shareToken: string) => http.get<FormDetail>(`/public/entries/${shareToken}/form`),
}
