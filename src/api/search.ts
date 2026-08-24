import { http } from "./http"
import type { Page } from "./forms"

/**
 * One thing the search found.
 *
 * ⚠️ **`metadata` is how a hit knows where it lives.** The search index cannot know this product's
 * routes, so it hands back the identifiers — a form id, a purpose code — and the browser builds the
 * address. That is why the map is untyped: adding a hit kind must not need a backend change here.
 */
export interface SearchHit {
  type: string
  id: string
  title: string
  subtitle: string | null
  score: number
  metadata: Record<string, string>
}

/** ⚠️ Served, not compiled in — a kind the backend adds appears with its own label and glyph. */
export interface SearchTypeDescriptor {
  type: string
  label: string
  icon: string
}

export const searchApi = {
  search: (query: string, spaceId: string | undefined, types?: string[], page = 0, size = 20) =>
    http.get<Page<SearchHit>>("/search", {
      params: {
        q: query,
        spaceId: spaceId ?? undefined,
        types: types && types.length > 0 ? types.join(",") : undefined,
        page,
        size,
      },
    }),

  types: () => http.get<SearchTypeDescriptor[]>("/search/types"),
}
