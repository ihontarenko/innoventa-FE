import {
  playgroundTransportOver,
  savedQueryTransportOver,
  sourceTransportOver,
  transportOver,
  type QueryTransport,
} from "@jmouse/query"
import { createApiClient } from "@/api/http"
import { LIBRARY_ROUTES } from "@/api/libraryRoutes"

const http = createApiClient(LIBRARY_ROUTES.query)

/**
 * How the shared filter builder reaches Innoventa's backend.
 *
 * ## ⚠️ Innoventa's OWN client, never a second one
 *
 * `http` carries the workspace header, the queued token refresh and the error events every other screen
 * depends on. A shared package bringing its own client would mean a request that skips all of it — and
 * the failure is a silent sign-out on one panel while every other screen quietly re-authenticates.
 *
 * ## ⚠️ The base is the LIBRARY's, and the prefix is therefore empty
 *
 * The builder used to answer at `/api/query` — inside this product's own URL space — and since
 * 2026-08-25 every library surface is under `/jmouse/…` (see `api/libraryRoutes.ts`). So the client is
 * built on `LIBRARY_ROUTES.query` and the transport adds nothing of its own.
 *
 * ⚠️ **A client of its own, and it still is not a second client in the harmful sense**: `createApiClient`
 * is the same factory `http` comes from, so the queued token refresh, the workspace header and the error
 * events all come with it. What must never happen is a *package* bringing its own axios — see above.
 */
const PREFIX = ""

const request = async (method: string, url: string, body?: unknown) => {
  const response =
    method === "GET"
      ? await http.get(url)
      : method === "PUT"
        ? await http.put(url, body)
        : method === "DELETE"
          ? await http.delete(url)
          : await http.post(url, body)

  return response.data
}

export const queryTransport: QueryTransport = {
  ...transportOver((method, url, body) => request(method, url, body), PREFIX),

  /**
   * ⚠️ The saved-view half, and naming it here is how this product adopts saved views.
   *
   * The library renders no shelf without it — not an empty one, not a disabled button — because a shelf
   * that can never fill reads as *you have saved nothing* rather than as *this product does not keep
   * these*, and the first is a lie somebody acts on.
   *
   * ⚠️ **The five addresses are the LIBRARY's, and were written out by hand here until 2026-08-25.**
   * Every one of them was built from the subject's name alone — and a subject is a name *and* the
   * parameters that say which listing of that name it is. So each call asked about `entries` rather than
   * about one form: every form's shelf held every other form's questions, a bug report offered *fewer
   * than ten in stock*, and a view kept on one form was saved where all of them could see it. It answered
   * 200 throughout. `savedQueryTransportOver` builds them from one address function that cannot forget.
   *
   * ⚠️ Which listing a view belongs to is the BACKEND subject's answer — entries hang off the form,
   * equipment off the workspace — never this file's.
   */
  views: savedQueryTransportOver((method, url, body) => request(method, url, body), PREFIX),

  /**
   * ⚠️ The declaration half — reading what a listing IS, and rewriting it where that is allowed.
   *
   * Naming it here is how this product adopts the Declaration and Attributes tabs; without it the
   * screen shows neither, rather than showing tabs whose backend answers 404. What may actually be
   * written is still decided per listing by `QuerySubject.origin` and `authorizeSourceWrite`, so
   * wiring this does not make anything editable by itself.
   */
  sources: sourceTransportOver((method, url, body) => request(method, url, body), PREFIX),

  /**
   * ⚠️ Compiling a query without running it — the SQL, never the rows.
   *
   * The library deliberately does not execute anything: running a query needs a scope built from the
   * session, paging and a loader, none of which is the same in two products. So what this wires up is
   * the half that can honestly be shared, and it is also the half that answers the question somebody
   * has while checking a mapping.
   */
  playground: playgroundTransportOver((method, url, body) => request(method, url, body), PREFIX),
}
