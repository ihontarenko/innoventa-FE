import { http } from "./http"

export interface PriceBreak {
  quantity: number
  unitPrice: number
}

/** One distributor's answer about one part. ⚠️ Almost every field is nullable — providers differ. */
export interface LookupOffer {
  partNumber: string | null
  manufacturer: string | null
  description: string | null
  detailedDescription: string | null
  currency: string | null
  stock: number | null
  buyUrl: string | null
  dataSheetUrl: string | null
  vendorSku: string | null
  productStatus: string | null
  rohs: string | null
  moq: number | null
  leadTime: string | null
  imageUrl: string | null
  category: string | null
  priceBreaks: PriceBreak[]
}

export interface LookupResult {
  query: string
  provider: string
  offers: LookupOffer[]
}

/**
 * What a distributor knows about a part.
 *
 * ⚠️ **A live call to somebody else's API, and it fails in their words.** No API key, a rate limit and a
 * part that does not exist are three different answers, and the screen has to show the backend's own
 * sentence rather than "search failed" — the first is actionable and the second sends somebody to check
 * their spelling.
 */
export const lookupApi = {
  search: (provider: string, query: string) =>
    http.get<LookupResult>(`/lookup/${provider}`, { params: { query } }),

  /** The same question asked about a row already held, so the part number comes from the entry. */
  searchByEntry: (entryId: string, provider: string) =>
    http.get<LookupResult>(`/entries/${entryId}/lookup/${provider}`),
}
