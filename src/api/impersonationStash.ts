import {
  AUTH_STORE_KEY,
  IMPERSONATION_STORE_KEY,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from "./tokenStorage"

/**
 * The administrator's own credentials, kept aside while they work as somebody else.
 *
 * ⚠️ **This is the only route back.** No endpoint mints an administrator token from an impersonation
 * token — that path deliberately does not exist, because it would turn a leaked thirty-minute token
 * into leaked administrative access. Leaving a session therefore means putting back what the browser
 * stashed, and a lost stash costs a fresh sign-in. That is the intended trade rather than a gap.
 *
 * ⚠️ Plain `localStorage` and no imports beyond the token keys, so the HTTP client can consult it while
 * handling a 401 without the two modules importing each other.
 */

const STASH_KEY = "innoventa.impersonation.stash"

interface StashedCredentials {
  accessToken: string
  refreshToken: string
  /** The persisted auth store verbatim, so the restored session is the administrator's own again. */
  authState: string | null
}

/**
 * Puts the administrator's current credentials aside. Called before the borrowed token replaces them.
 *
 * The persisted auth store goes with them. Restoring only the tokens would leave the impersonated
 * user's name and permissions in the store until the next profile fetch came back, so the first frame
 * after leaving would show the administrator signed in as somebody they had just left.
 */
export function stashAdministrator(): void {
  const accessToken = getAccessToken()
  const refreshToken = getRefreshToken()

  if (!accessToken || !refreshToken) {
    return
  }

  localStorage.setItem(
    STASH_KEY,
    JSON.stringify({ accessToken, refreshToken, authState: localStorage.getItem(AUTH_STORE_KEY) }),
  )
}

export function hasStashedAdministrator(): boolean {
  return localStorage.getItem(STASH_KEY) !== null
}

/**
 * Puts the administrator's credentials back and forgets the session.
 *
 * @returns whether there was anything to restore. False means the stash is gone — the session can only
 *          end in a fresh sign-in, which is the cost of there being no server-side way back.
 */
export function restoreAdministrator(): boolean {
  const stashed = readStash()

  forgetImpersonation()

  if (!stashed) {
    return false
  }

  saveTokens(stashed.accessToken, stashed.refreshToken)

  if (stashed.authState) {
    localStorage.setItem(AUTH_STORE_KEY, stashed.authState)
  }

  return true
}

/**
 * Drops both the stash and the persisted session.
 *
 * ⚠️ The session is a zustand store's key rather than this module's, and reaching into it is
 * deliberate: the two have to go together, and the one moment they must is a token expiring inside an
 * HTTP interceptor, which is nowhere near a React tree that could call the store.
 */
export function forgetImpersonation(): void {
  localStorage.removeItem(STASH_KEY)
  localStorage.removeItem(IMPERSONATION_STORE_KEY)
}

function readStash(): StashedCredentials | null {
  const raw = localStorage.getItem(STASH_KEY)

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as StashedCredentials
  } catch {
    return null
  }
}
