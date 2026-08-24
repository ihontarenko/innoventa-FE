import { transportOver } from "@jmouse/query"
import { http } from "@/api/http"

/**
 * How the shared filter builder reaches Innoventa's backend.
 *
 * ## ⚠️ Innoventa's OWN client, never a second one
 *
 * `http` carries the workspace header, the queued token refresh and the error events every other screen
 * depends on. A shared package bringing its own client would mean a request that skips all of it — and
 * the failure is a silent sign-out on one panel while every other screen quietly re-authenticates.
 *
 * ## ⚠️ The prefix is `/query`, because the client's base is already `/api`
 *
 * The library answers on `/api/query` by default (`jmouse.query.builder.prefix`). Moving it on the
 * backend means moving it here — the address lives in exactly two places and there is deliberately no
 * third.
 */
export const queryTransport = transportOver(
  async (method, url, body) => {
    const response =
      method === "GET" ? await http.get(url) : await http.post(url, body)

    return response.data
  },
  "/query",
)
