import { http } from "./http"
import type { Page } from "./forms"

/**
 * Counting sheets: what the system believed, what was actually found, and the movements that close the
 * gap.
 *
 * ⚠️ **`expected` is frozen and `nowInSystem` is not.** The first is what the position held when the
 * sheet was drawn — the number the count is judged against — and the second is what it holds this
 * second. The two differing means somebody moved stock while the sheet was being walked, and the screen
 * shows both rather than picking one.
 */

export type StocktakeStatus = "OPEN" | "COUNTING" | "CLOSED"

export interface StocktakeLine {
  entryId: string
  label: string
  partId: string | null
  locationId: string | null
  locationPath: string | null
  unit: string | null
  expected: number
  /** ⚠️ `null` is "nobody counted this", never zero — zero is a finding that the drawer was empty. */
  counted: number | null
  difference: number | null
  nowInSystem: number
  countedBy: string | null
  countedAt: string | null
}

export interface Stocktake {
  id: string
  number: string
  status: StocktakeStatus
  locationId: string | null
  locationPath: string | null
  catalogFormId: string | null
  catalogFormName: string | null
  includeNested: boolean
  responsibleHolderId: string | null
  responsibleName: string | null
  note: string | null
  createdAt: string
  startedAt: string | null
  closedAt: string | null
  lineCount: number
  counted: number
  discrepancies: number
  netDifference: number
  lines: StocktakeLine[]
}

/** The list row — the same numbers without the rows themselves. */
export interface StocktakeSummary {
  id: string
  number: string
  status: StocktakeStatus
  scopeLabel: string
  locationId: string | null
  catalogFormId: string | null
  responsibleName: string | null
  createdAt: string
  startedAt: string | null
  closedAt: string | null
  lineCount: number
  counted: number
  discrepancies: number
  netDifference: number
}

/**
 * ⚠️ **A scope is a place OR a type, never both and never neither.** Both describes a walk nobody does;
 * neither is the whole workspace, which is not a stocktake.
 */
export interface CreateStocktakeRequest {
  locationId?: string | null
  catalogFormId?: string | null
  includeNested?: boolean
  responsibleHolderId?: string | null
  note?: string | null
  /** Narrows the scope to rows somebody picked — it does not replace the scope. */
  entryIds?: string[]
}

export interface StocktakePreview {
  positions: number
  scopeLabel: string
}

/** ⚠️ `notCounted` is named rather than folded into anything — closing with blanks is a decision. */
export interface CloseStocktakeResult {
  id: string
  number: string
  posted: number
  unchanged: number
  notCounted: number
  netDifference: number
}

export const stocktakesApi = {
  list: (status: StocktakeStatus | null, page = 0, size = 25) =>
    http.get<Page<StocktakeSummary>>("/stocktakes", {
      params: { status: status ?? undefined, page, size },
    }),

  get: (id: string) => http.get<Stocktake>(`/stocktakes/${id}`),

  /** What drawing a sheet over this scope would collect, before anybody commits to it. */
  preview: (request: CreateStocktakeRequest) =>
    http.post<StocktakePreview>("/stocktakes/preview", request),

  create: (request: CreateStocktakeRequest) => http.post<Stocktake>("/stocktakes", request),

  start: (id: string) => http.post<Stocktake>(`/stocktakes/${id}/start`),

  count: (id: string, entryId: string, counted: number) =>
    http.put<Stocktake>(`/stocktakes/${id}/lines/${entryId}`, { counted }),

  clearCount: (id: string, entryId: string) =>
    http.delete<Stocktake>(`/stocktakes/${id}/lines/${entryId}`),

  close: (id: string) => http.post<CloseStocktakeResult>(`/stocktakes/${id}/close`),

  remove: (id: string) => http.delete<void>(`/stocktakes/${id}`),
}
