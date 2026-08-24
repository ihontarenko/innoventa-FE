import { http } from "./http"
import type { FormDetail, FormEntry } from "@/types"

/**
 * What somebody with no account at all can reach.
 *
 * ⚠️ **A share token IS the authorisation.** There is no header, no workspace and no permission on any of
 * these — holding the link is the whole of what the backend checks, which is why the tokens are long and
 * why revoking one is the only way to take access back. `http.ts` knows not to attempt a token refresh on
 * a 401 from here: a visitor with no session must see the resource's own answer, not a sign-in page.
 */
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
