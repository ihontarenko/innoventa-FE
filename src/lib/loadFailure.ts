import { detailOf } from "@/lib/apiErrors"

/**
 * Why something a screen needed did not arrive.
 *
 * ⚠️ **The four are told apart because they send the reader to four different places.** A refusal is a
 * question for whoever grants permissions, a 5xx is a question for whoever reads the log, an absence is
 * a question for nobody, and an unreachable server is a question for the person who stopped it. Folding
 * them into one "could not load" is how a reader spends an afternoon on the access screen because the
 * backend threw — which is exactly what `INVT-0109` was.
 */
export type LoadFailureKind = "offline" | "broken" | "refused" | "missing"

export interface LoadFailure {
  kind: LoadFailureKind
  /** The HTTP status, where there was a response at all. Rendered, because it is what makes a log findable. */
  status?: number
  title: string
  detail?: string
  /** Whether pressing a button again could plausibly change the answer. */
  retryable: boolean
}

/**
 * The failure state of a react-query read, or nothing while it is still working.
 *
 * ⚠️ **`isPaused` is a failure, and it is the one that looks like patience.** A query whose retry is
 * held back — react-query believes there is no network — stays `pending` with no error attached
 * forever, so a screen keyed on `isError` alone draws its loading skeleton until somebody navigates
 * away. That is half of what `INVT-0109` looked like: a drawer that never stopped loading.
 *
 * ⚠️ **Call it with the whole query, not with `error`.** The point is that the two states must be read
 * together; handing a screen only the error is what let the paused one go unnoticed.
 */
export function describeQueryFailure(
  query: { isError: boolean; isPaused: boolean; error: unknown },
  what: string,
): LoadFailure | undefined {
  if (query.isPaused) {
    return {
      kind: "offline",
      title: "The server could not be reached",
      detail: "This is waiting for the connection to come back.",
      retryable: true,
    }
  }

  if (query.isError) {
    return describeLoadFailure(query.error, what)
  }

  return undefined
}

/**
 * Reads a failed request into something a screen can draw.
 *
 * ⚠️ **`what` is the thing in the reader's words, not the endpoint's** — "form", "entry", "workspace".
 * It is interpolated into a sentence, so it stays lower case and singular.
 *
 * ⚠️ **It never throws and always answers.** A network failure carries no response, a proxy can answer
 * HTML, and an interceptor can reject something that is not an error at all; every one of those is
 * ordinary, and the worst outcome here is a vaguer sentence rather than a blank screen.
 */
export function describeLoadFailure(error: unknown, what: string): LoadFailure {
  const typedError = error as { isNetworkError?: boolean; response?: { status?: number } }
  const status = typedError?.response?.status
  // ⚠️ **The server's own sentence or nothing.** Not `problemDetailOf`, which falls back to the client
  // library's message — and "Request failed with status code 500" under a heading that already said the
  // form could not be loaded is a line that costs space and carries nothing.
  const said = detailOf(error)

  if (typedError?.isNetworkError || status === undefined) {
    return {
      kind: "offline",
      title: "The server could not be reached",
      detail: "It may be restarting — try again in a moment.",
      retryable: true,
    }
  }

  if (status === 401 || status === 403) {
    return {
      kind: "refused",
      status,
      title: `This ${what} is not one you can open`,
      // The server's own sentence names the permission where it can; ours never could.
      detail: said,
      retryable: false,
    }
  }

  if (status === 404) {
    return {
      kind: "missing",
      status,
      title: `This ${what} no longer exists`,
      detail: said,
      retryable: false,
    }
  }

  return {
    kind: "broken",
    status,
    title: `This ${what} could not be loaded`,
    // ⚠️ The status is the whole point of this branch: it is what tells a reader to go and read the
    // backend log instead of going to ask for access.
    detail: said ?? `The server answered ${status}. Whoever runs it can see why in its log.`,
    retryable: status >= 500,
  }
}
