import { useQuery } from "@tanstack/react-query"
import { pricingApi, type PricingResult } from "@/api/pricing"

/**
 * A distributor's answer about a part.
 *
 * ⚠️ **Cached for five minutes, keyed by provider *and* query.** It is somebody else's rate-limited API,
 * and the ordinary use of this screen is typing a part number, reading the offers, and coming back to it
 * two screens later — refetching that is spending somebody's quota to re-read what has not changed.
 *
 * ⚠️ **`enabled` is the search, not the typing.** This screen deliberately does not search as you type:
 * a part number is entered whole, and a request per keystroke is a request per keystroke against a paid
 * API.
 */
export function usePricingSearch(provider: string, query: string, enabled: boolean) {
  return useQuery<PricingResult>({
    queryKey: ["pricing", provider, query],
    queryFn: () => pricingApi.search(provider, query).then((response) => response.data),
    enabled: enabled && query.length > 0,
    staleTime: 5 * 60_000,
    // ⚠️ Never retried. A missing API key and a rate limit both come back as errors, and retrying either
    // one turns a clear message into a slow clear message.
    retry: false,
  })
}
