import { transportOver, type MapperTransport } from "@jmouse/mapper"
import { createApiClient } from "@/api/http"
import { LIBRARY_ROUTES } from "@/api/libraryRoutes"

const http = createApiClient(LIBRARY_ROUTES.mapper)

/**
 * How the shared `.jmm` builder reaches Innoventa's backend.
 *
 * ## ⚠️ Innoventa's OWN client, never a second one
 *
 * `createApiClient` carries the workspace header, the queued token refresh and the error events every
 * other screen depends on. A shared package bringing its own client would mean a request that skips all
 * of it — and the failure is a silent sign-out on one panel while every other screen quietly
 * re-authenticates.
 *
 * ## ⚠️ The base is the LIBRARY's, so the prefix is empty
 *
 * Every library surface answers under `/jmouse/<namespace>/api` and this one is no exception — see
 * `api/libraryRoutes.ts` for why that address lives in exactly one file here.
 *
 * ## ⚠️ The refusal has to survive the client
 *
 * A document the form cannot show comes back as **422 with a `construct` property** on an RFC 7807 body.
 * The package reads that off whatever was thrown, looking at the error itself, at `error.body` and at
 * `error.response.data` — which is where an axios rejection keeps it. Nothing has to be unwrapped here;
 * what must not happen is this file swallowing the body and re-throwing a bare `Error`, which would turn
 * *the form cannot show a fragment* into *something went wrong*.
 */
const request = async <T>(method: "GET" | "POST", url: string, body?: unknown): Promise<T> => {
  const response = method === "GET" ? await http.get(url) : await http.post(url, body)

  return response.data as T
}

export const mapperTransport: MapperTransport = transportOver(request, "")
