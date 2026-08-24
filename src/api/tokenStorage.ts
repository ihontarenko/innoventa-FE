/**
 * Where the browser keeps its credentials, and nothing else.
 *
 * ⚠️ **The keys are the old interface's, deliberately.** `FE` and `UI` run side by side for the whole
 * migration against the same backend; a second pair of key names would mean signing in twice and,
 * worse, one interface silently holding a session the other has already ended.
 *
 * Split out of `http.ts` so that whatever needs to put tokens back — impersonation, when
 * `INVT-0055` brings it over — can do so without importing the HTTP client, which would import it
 * back and leave the cycle to be resolved by whichever module the bundler reached first.
 */

const ACCESS_KEY = "innoventa.access"
const REFRESH_KEY = "innoventa.refresh"

/** Named here rather than only in the store, because the 401 path has to clear it from far outside React. */
export const AUTH_STORE_KEY = "innoventa.auth"

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}

/**
 * @param refresh an empty string means "no refresh token", which is what an impersonated session
 *                holds. It is removed rather than stored empty, so the 401 path sees its absence
 *                rather than a token it would try to spend.
 */
export function saveTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS_KEY, access)

  if (refresh) {
    localStorage.setItem(REFRESH_KEY, refresh)
    return
  }

  localStorage.removeItem(REFRESH_KEY)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(AUTH_STORE_KEY)
}

/** The impersonation session's own key, so the 401 path can drop it without importing the store. */
export const IMPERSONATION_STORE_KEY = "innoventa.impersonation"
