import { http } from "./http"

/** ⚠️ `MANUAL` is a row that has deliberately stopped tracking the feed. It has to be visible at a glance. */
export type ExchangeRateSource = "PROVIDER" | "MANUAL"

export interface ExchangeRateView {
  currency: string
  rateToPivot: number
  /** What the rate is quoted against — repeated per row because it is what the number MEANS. */
  pivot: string
  source: ExchangeRateSource
  updatedAt: string
}

export interface ExchangeRatesResponse {
  /** What every rate is quoted against — the feed's currency, not necessarily this installation's. */
  pivot: string
  /** What this installation totals in. ⚠️ Frequently NOT the pivot; the screen has to say both. */
  baseCurrency: string
  provider: string
  /** ⚠️ Absent where nothing has ever been synced — which is a fresh installation, not a fault. */
  lastUpdated?: string
  rates: ExchangeRateView[]
}

export interface SyncResponse {
  provider: string
  pivot: string
  published: number
  written: number
  /** ⚠️ Reported, never hidden: "12 written" with no mention of the 3 skipped reads as a broken sync. */
  leftAsManual: number
}

/**
 * What a currency is worth, and who says so.
 *
 * ⚠️ **`sync` is a POST because it writes rows and calls a foreign bank.** Behind a link it would be run
 * by every crawler and every prefetch the browser felt like doing.
 */
export const exchangeRatesApi = {
  list: () => http.get<ExchangeRatesResponse>("/admin/exchange-rates"),
  sync: () => http.post<SyncResponse>("/admin/exchange-rates/sync"),
  setManual: (currency: string, rate: number) =>
    http.put<ExchangeRateView>(`/admin/exchange-rates/${currency}`, { rate }),
  resetToProvider: (currency: string) => http.post<ExchangeRateView>(`/admin/exchange-rates/${currency}/reset`),
}
