import { QueryCache, QueryClient } from "@tanstack/react-query"

function isNetworkOrServerError(error: unknown): boolean {
  const typedError = error as { isNetworkError?: boolean; isServerError?: boolean }

  return !!(typedError?.isNetworkError || typedError?.isServerError)
}

/**
 * ⚠️ **Every failed read says so in the console, once, from here.**
 *
 * A query that fails hands its error to whichever component asked — and a component that renders a
 * skeleton or an empty state instead swallows it whole. `INVT-0109` was found through the network panel
 * for exactly this reason: a 500 on the form schema left the console spotless. One place logging every
 * one of them beats each screen remembering to, because the screens that forget are the ones that
 * needed it.
 *
 * ⚠️ **A query, not a mutation.** A failed write already reaches the person as a toast; repeating it
 * here would only add noise to the one channel that is now worth reading.
 */
const queryCache = new QueryCache({
  onError: (error, query) => {
    console.error("[innoventa] a query failed:", query.queryKey, error)
  },
})

/**
 * ⚠️ **A network or 5xx failure is not retried, and that is deliberate.** `http.ts` marks both, and
 * retrying them means the reader waits twice as long to be told the same thing — the backend being
 * down is an answer, not a flaky call.
 */
export const queryClient = new QueryClient({
  queryCache,
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (count, error) => !isNetworkOrServerError(error) && count < 1,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
})
