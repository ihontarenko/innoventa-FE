import { http } from "./http"

/**
 * What a workspace calls its own nouns.
 *
 * ⚠️ **Not application i18n.** Central owns this product's copy per *language*; this is the other axis —
 * what *this workspace* calls a unit, which differs between two workspaces in the same language. A
 * construction yard and a laboratory both speak Ukrainian and disagree about what a thing is.
 */
export interface Terminology {
  /** Every word a screen should use — the subject area's defaults with this workspace's overrides on top. */
  words: Record<string, string>
  /** What the subject area says, so a screen can show what a reset would restore. */
  defaults: Record<string, string>
  /** The keys a workspace may rename. Fixed, so a typo cannot become a setting nothing reads. */
  nouns: string[]
}

export const terminologyApi = {
  words: (spaceId: string) => http.get<Terminology>(`/spaces/${spaceId}/terms`),

  /** ⚠️ A blank value goes back to the default rather than storing an empty word. */
  rename: (spaceId: string, wanted: Record<string, string>) =>
    http.put<Terminology>(`/spaces/${spaceId}/terms`, wanted),
}
