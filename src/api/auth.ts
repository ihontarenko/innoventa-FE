import { http } from "./http"
import type { LoginResponse, MessageResponse, TokenPairResponse, UserProfile } from "@/types"

/**
 * ⚠️ **Innoventa mints its own tokens; it is not an Identity client.** Tessera and Kiwi sign in
 * through the OAuth2 server on 9090 with `oidc-client-ts`; this product's backend issues the pair
 * itself at `/api/auth/*` and carries its own OAuth2 hand-off for Google and GitHub at `/oauth2/*`.
 *
 * So the skeleton keeps the interface it already had rather than adopting Tessera's — the decision is
 * recorded on `INVT-0052`. Moving Innoventa onto Identity is a real question, and a backend one; it is
 * not something a port of the interface gets to decide by picking a library.
 */
export interface RegistrationRequest {
  email: string
  password: string
  displayName?: string
  /** Sent only where the installation requires one — see `usePublicConfiguration`. */
  inviteCode?: string
}

export const authApi = {
  login: (email: string, password: string) => http.post<LoginResponse>("/auth/login", { email, password }),

  register: (request: RegistrationRequest) => http.post<UserProfile>("/auth/register", request),

  verifyEmail: (token: string) => http.post<MessageResponse>("/auth/verify-email", { token }),

  /**
   * ⚠️ **Always answers the same way, whether or not the address is on file.** Telling a stranger which
   * of their guesses is a real account is exactly the thing a sign-in form is careful not to do; the
   * screen therefore says "if an account exists" rather than reporting what happened.
   */
  requestMagicLink: (email: string) => http.post<MessageResponse>("/auth/magic-link", { email }),

  verifyMagicLink: (token: string) => http.post<LoginResponse>("/auth/magic-link/verify", { token }),

  /**
   * ⚠️ **A GET, and the one-time code is in the query string** — that is the backend's shape, decided
   * where the provider hand-off lands. The code is single-use and already travelled through the address
   * bar to get here, so putting it in one more URL costs nothing it has not already spent.
   */
  exchangeOAuth2Code: (code: string) =>
    http.get<TokenPairResponse>(`/auth/oauth2/token?code=${encodeURIComponent(code)}`),

  refresh: (refreshToken: string) => http.post<TokenPairResponse>("/auth/refresh", { refreshToken }),

  logout: (refreshToken: string) => http.post<MessageResponse>("/auth/logout", { refreshToken }),

  getProfile: () => http.get<UserProfile>("/auth/me"),

  verifyTwoFactor: (pendingToken: string, code: string) =>
    http.post<LoginResponse>("/auth/2fa/verify", { pendingToken, code }),

  getPreferences: () => http.get<Record<string, string>>("/auth/me/preferences"),

  setPreference: (key: string, value: string) =>
    http.put<Record<string, string>>(`/auth/me/preferences/${encodeURIComponent(key)}`, { value }),

  /** ⚠️ Blank clears it — the profile then shows the email, which is what an unnamed account looks like. */
  changeDisplayName: (displayName: string) => http.put<UserProfile>("/auth/me/display-name", { displayName }),

  changePassword: (currentPassword: string, newPassword: string) =>
    http.put<MessageResponse>("/auth/me/password", { currentPassword, newPassword }),

  setup2fa: () => http.post<TwoFactorSetupResponse>("/auth/2fa/setup"),

  confirm2fa: (plainTextSecret: string, verificationCode: string) =>
    http.post<MessageResponse>("/auth/2fa/confirm", { plainTextSecret, verificationCode }),

  /** ⚠️ A DELETE with a body — the password is a confirmation, not an address, so it does not go in the URL. */
  disable2fa: (password: string) => http.delete<MessageResponse>("/auth/2fa", { data: { password } }),
}

/** The QR image and the secret behind it — shown once, and never fetched again. */
export interface TwoFactorSetupResponse {
  qrCodeBase64: string
  plainTextSecret: string
}
