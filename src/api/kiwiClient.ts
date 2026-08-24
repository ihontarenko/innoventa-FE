import axios from "axios"
import { identityAccessToken } from "@/auth/identityAuth"

/**
 * Client for **Kiwi** — the knowledge product that owns pages (`KW-10`; `KW-1` §1; INVT-0097).
 *
 * <h2>⚠️ Innoventa's own token is deliberately NOT sent here</h2>
 *
 * This is the one client in the interface that does not use `api/http.ts`, and the reason is not the
 * origin — it is **whose token**. Innoventa mints its own pair at `/api/auth/*` and Kiwi cannot read
 * one; Kiwi reads an **Identity** token, which this browser acquires separately (`auth/identityAuth`).
 * Sending the wrong one would 401 in a way that looks like a broken session in *this* product.
 *
 * ⚠️ **And the product's own credential is not sent either.** `Innoventa/BE` holds one — that is how
 * the public manual is republished (`INVT-0092`) — and using it for a signed-in reader would hand
 * everybody everything the product was granted, and make Innoventa a second authority over who may
 * read a page. Kiwi is the only one. That is the architecture, not a preference.
 *
 * <h2>⚠️ Two things it deliberately does not do</h2>
 *
 * - **No sign-in redirect on 401.** A call to another product must never bounce somebody out of the
 *   screen they are on. A 401 here means the wiki cannot draw, not that this session is over — and
 *   *this* session is Innoventa's, which is not the one that expired.
 * - **No retry, and a short timeout.** A product that is down should cost one panel and one honest
 *   sentence, not a screen that hangs.
 *
 * <h2>⚠️ There is no cache, deliberately</h2>
 *
 * `KW-1` §12, and the argument is not simplicity: `@CATEGORY` grants are checked on every read, so **a
 * cached page keeps rendering after somebody's access has been taken away.**
 */
export const kiwiClient = axios.create({
  // Proxied to Kiwi (:8110) by `vite.config.ts` in development, so the browser sees a same-origin call.
  // In a deployment it is a real cross-origin request and Kiwi's own CORS allowlist is what permits it —
  // which is why Kiwi is the one backend in this workspace that has one.
  baseURL: "/kiwi-api",
  timeout: 8000,
})

kiwiClient.interceptors.request.use(async (requestConfiguration) => {
  const token = await identityAccessToken()

  if (token) {
    requestConfiguration.headers.set("Authorization", `Bearer ${token}`)
  }

  return requestConfiguration
})

/**
 * Whether this failure means **Kiwi could not be reached at all**, as opposed to Kiwi answering "no".
 *
 * ⚠️ The distinction is the whole of `KW-10`'s second half. *Unreachable* is an infrastructure fact and
 * the screen says so; *403* and *404* are Kiwi's own answers about this reader and mean something quite
 * different — usually that they have not been granted the section, which is not a fault at all.
 */
export function isKiwiUnreachable(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false
  }

  // No response at all: a refused connection, DNS, a timeout, or a CORS preflight Kiwi never answered.
  if (!error.response) {
    return true
  }

  // 5xx is Kiwi being broken rather than Kiwi deciding something.
  return error.response.status >= 500
}

/**
 * Whether Kiwi refused because this browser presented no Identity token, or a dead one.
 *
 * ⚠️ **Its own question, because the answer is a button rather than an apology.** Every other refusal
 * here means *you were not granted that*; this one means *you have not connected yet*, and the screen
 * that confuses them tells somebody to go and ask an administrator for something one click would fix.
 */
export function needsIdentityConnection(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401
}
