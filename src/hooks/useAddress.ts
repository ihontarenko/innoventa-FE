import { useSearchParams } from "react-router-dom"
import type { AppliedQuery } from "@jmouse/query"

/** Keys a listing reserves in its own address. Named once so a page cannot spell one differently. */
export const ADDRESS_KEYS = {
  FILTER: "jmq:filter",
  ORDER: "jmq:order",
  PAGE: "page",
} as const

export type Amend = (
  changes: Record<string, string | null>,
  options?: { push?: boolean },
) => void

/**
 * The address as the screen's state — the parameters, one amender, and the applied query.
 *
 * <h2>⚠️ Written four times before this, and each copy differed</h2>
 *
 * <p>Every list screen had grown its own `amend`: one treated `""` as a removal and the others did not,
 * one pushed a history entry and the rest replaced, one read `parameters` directly and so lost a write
 * whenever two keys changed at once. All four were "the same helper", and the differences were only
 * visible as behaviour — a Back button that walked through a search term one letter at a time, or a page
 * number that survived a filter it no longer indexes.
 *
 * <h2>⚠️ The filter belongs here rather than in `useState`, and that is the whole point</h2>
 *
 * <p>A filter held in memory is lost on reload and absent from a link somebody sends: the recipient opens
 * the same address and sees an unnarrowed list, with nothing to tell them so. It is also what makes a
 * filter *link* possible at all — a cell that narrows a list to its own value has nowhere to put the
 * answer except the address.
 */
export function useAddress() {
  const [parameters, setParameters] = useSearchParams()

  /**
   * ⚠️ **One write for however many keys change.** Two `setParameters` calls in a row both read the same
   * stale value, so the second silently undoes the first — which is exactly what happens when choosing a
   * type also has to reset the page.
   *
   * ⚠️ **`replace` by default.** Typing pushes a history entry per keystroke otherwise, and Back then
   * walks backwards through a search term one letter at a time instead of leaving the screen. A
   * deliberate move — choosing a type — passes `push`.
   *
   * <p>An empty string removes the key, like `null`: a parameter present and blank narrows nothing and
   * only makes the address harder to read.
   */
  function amend(changes: Record<string, string | null>, options?: { push?: boolean }) {
    setParameters(
      (previous) => {
        const next = new URLSearchParams(previous)

        for (const [key, value] of Object.entries(changes)) {
          if (value === null || value === "") {
            next.delete(key)
          } else {
            next.set(key, value)
          }
        }

        return next
      },
      { replace: !options?.push },
    )
  }

  const query: AppliedQuery = {
    filter: parameters.get(ADDRESS_KEYS.FILTER),
    order: parameters.get(ADDRESS_KEYS.ORDER),
  }

  /** Narrowing starts over — page three of the old answer is not page three of the new one. */
  function setQuery(applied: AppliedQuery) {
    amend({
      [ADDRESS_KEYS.FILTER]: applied.filter || null,
      [ADDRESS_KEYS.ORDER]: applied.order || null,
      [ADDRESS_KEYS.PAGE]: null,
    })
  }

  return { parameters, amend, query, setQuery }
}
