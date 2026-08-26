import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios"
import { useSpaceStore } from "@/stores/spaceStore"
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "./tokenStorage"
import type { TokenPairResponse } from "@/types"

export { clearTokens, getAccessToken, getRefreshToken, saveTokens }

/**
 * Where Innoventa's own API answers.
 *
 * ⚠️ Also where the token is refreshed, whichever client hit the 401. A library mounted on a second
 * base path does not get a second `/auth/refresh` — that route is this product's, always.
 */
const BASE_URL = "/api"

/**
 * ⚠️ **Module level, not per client, and that is the whole point.** Two clients hitting 401 at the
 * same moment must queue behind ONE refresh; a per-instance copy of this state is how two of them race
 * into two refreshes and the loser is signed out.
 */
let isRefreshing = false
let pendingQueue: Array<{ resolve: (value: string) => void; reject: (reason: unknown) => void }> = []

function processQueue(error: unknown, token: string | null = null) {
  for (const { resolve, reject } of pendingQueue) {
    if (error) {
      reject(error)
      continue
    }

    resolve(token!)
  }

  pendingQueue = []
}

/**
 * The share routes, which are read by somebody with no account at all. A 401 there is the answer,
 * not a session problem — refreshing a token nobody has would send a visitor to a sign-in page they
 * were never meant to see.
 */
function isPublicRoute(): boolean {
  const pathname = window.location.pathname

  return (
    pathname.startsWith("/_/form/") ||
    pathname.startsWith("/_/entry/") ||
    pathname.startsWith("/_/viewer/") ||
    pathname.startsWith("/_/page/")
  )
}

/**
 * A client on one base path, carrying everything this application expects of an HTTP call.
 *
 * ⚠️ **A factory rather than a single instance, because there is more than one base path.**
 * `jmouse-ai-management` answers under its own prefix (`/jmouse/ai/api`) — deliberately not under `/api`,
 * so a request log can tell a handler the library ships from one Innoventa wrote. What must NOT differ
 * between the two is any of this: the bearer token, the active workspace, the refresh queue. Copying an
 * interceptor stack per base path is how a screen quietly stops refreshing its token and starts
 * bouncing people to the sign-in page.
 */
export function createApiClient(baseURL: string): AxiosInstance {
  const client = axios.create({ baseURL, withCredentials: false, timeout: 15_000 })

  client.interceptors.request.use(
    (configuration: InternalAxiosRequestConfig) => {
      const token = getAccessToken()

      if (token && configuration.headers) {
        configuration.headers.Authorization = `Bearer ${token}`
      }

      const activeSpaceId = useSpaceStore.getState().activeSpaceId

      if (activeSpaceId && configuration.headers) {
        configuration.headers["X-Space-Id"] = activeSpaceId
      }

      if (configuration.data !== undefined && !(configuration.data instanceof FormData)) {
        configuration.headers["Content-Type"] = "application/json"
      }

      return configuration
    },
    (error) => Promise.reject(error),
  )

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (!error.response) {
        error.isNetworkError = true
        return Promise.reject(error)
      }

      if (error.response.status >= 500) {
        error.isServerError = true
        return Promise.reject(error)
      }

      const originalRequest = error.config

      if (error.response.status !== 401 || originalRequest._retry) {
        return Promise.reject(error)
      }

      if (isPublicRoute()) {
        return Promise.reject(error)
      }

      const refreshToken = getRefreshToken()

      if (!refreshToken) {
        // ⚠️ An impersonated session holds no refresh token — that omission is the contract, and it is
        // what bounds the session whether or not the administrator remembers to leave. Putting the
        // administrator back rather than signing the borrowed account out is `INVT-0055`'s, along with
        // the rest of impersonation; until then this path is the plain one.
        clearTokens()
        window.location.href = "/auth/login"
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          pendingQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return client(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // ⚠️ Bare axios, not `client`: the refresh call must not go back through the interceptor that
        // is currently handling a 401, or a failing refresh recurses.
        const { data } = await axios.post<TokenPairResponse>(`${BASE_URL}/auth/refresh`, { refreshToken })

        saveTokens(data.accessToken, data.refreshToken)
        processQueue(null, data.accessToken)
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`

        return client(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        clearTokens()
        window.location.href = "/auth/login"

        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    },
  )

  return client
}

export const http: AxiosInstance = createApiClient(BASE_URL)
