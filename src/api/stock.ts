import { http } from "./http"

/**
 * What a price came to, in the currency it was written in.
 *
 * ⚠️ **`currency` is null where a price was stored without a unit**, and that is kept apart rather than
 * folded in: "12" and "12 UAH" are not the same claim, and a total that silently mixes them is a figure
 * somebody will quote.
 */
export interface StockValue {
  currency: string | null
  amount: number
}

export interface StockSummaryByType {
  formId: string
  formName: string
  icon: string | null
  rows: number
  units: number
  /** How many rows actually carried a quantity, and a price. See {@link StockSummary}. */
  countedRows: number
  pricedRows: number
  value: StockValue[]
}

/**
 * ⚠️ **`countedRows` and `pricedRows` are what make a zero explainable.** *Nothing is priced*, *nothing
 * says how many* and *everything is genuinely empty* all total nothing, and the first two are
 * configuration somebody can fix on the type's own Stock and Pricing panes. A strip that only said "0"
 * would send them to look at their data instead.
 */
export interface StockSummary {
  rows: number
  units: number
  value: StockValue[]
  countedRows: number
  pricedRows: number
  byType: StockSummaryByType[]
}

/**
 * What this workspace is holding, counted by the database.
 *
 * ⚠️ **The workspace is NOT a parameter.** The backend takes it from the active-space context, because
 * the module gate reads that context — a workspace named in the query string could admit a request on
 * the strength of one workspace and answer it out of another. `X-Space-Id` on the request is the whole
 * of the addressing.
 */
export const stockApi = {
  summary: (purposeCode: string) => http.get<StockSummary>("/stock/summary", { params: { purposeCode } }),
}
