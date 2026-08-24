import { useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { authApi, type RegistrationRequest } from "@/api/auth"
import { useAuthStore } from "@/stores/authStore"
import { useNavigationPreferencesStore } from "@/stores/navigationPreferencesStore"
import type { UserProfile } from "@/types"

/**
 * Who is signed in, according to the server.
 *
 * The store is kept in step from here rather than from the sign-in screen: a session restored from web
 * storage on a page reload never passes through sign-in, and a profile that only arrives on login is
 * how a sidebar ends up drawing yesterday's permissions.
 */
export function useProfile() {
  const setUser = useAuthStore((state) => state.setUser)
  const isAuthenticated = useAuthStore((state) => !!state.accessToken)
  const hydratePreferences = useNavigationPreferencesStore((state) => state.hydrateFromServer)

  const query = useQuery<UserProfile>({
    queryKey: ["profile"],
    queryFn: () => authApi.getProfile().then((response) => response.data),
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    if (query.data) {
      setUser(query.data)

      // ⚠️ Hydrated from here rather than fetched on the settings screen: the sidebar is drawn before
      // anybody opens settings, and a menu that un-hides itself for a moment on every load is a menu
      // whose personalisation reads as broken.
      hydratePreferences(query.data.preferences)
    }
  }, [query.data, setUser, hydratePreferences])

  return query
}

export function useSignIn() {
  const { setTokens, setPendingToken, setUser } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password).then((response) => response.data),
    onSuccess: (result) => {
      // ⚠️ A second factor answers with a pending token and NO access token. Treating the response as
      // a session because it came back 200 is how a half-authenticated account walks in.
      if (result.pendingToken) {
        setPendingToken(result.pendingToken)
        return
      }

      if (result.accessToken && result.refreshToken) {
        setTokens(result.accessToken, result.refreshToken)
      }

      if (result.user) {
        setUser(result.user)
        queryClient.setQueryData(["profile"], result.user)
      }
    },
  })
}

export function useSignOut() {
  const { refreshToken, logout } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    // The server is told, but the session ends either way: a network failure on the way out must not
    // leave somebody signed in on a screen they asked to leave.
    mutationFn: async () => {
      if (refreshToken) {
        await authApi.logout(refreshToken).catch(() => undefined)
      }
    },
    onSettled: () => {
      logout()
      queryClient.clear()
    },
  })
}

/**
 * The one fact on the profile card that is yours to change.
 *
 * ⚠️ Seeded from the response rather than invalidated: the route answers with the whole profile, and a
 * refetch would blank the card somebody has just typed into.
 */
export function useChangeDisplayName() {
  const queryClient = useQueryClient()
  const setUser = useAuthStore((state) => state.setUser)

  return useMutation<UserProfile, unknown, string>({
    mutationFn: (displayName) => authApi.changeDisplayName(displayName).then((response) => response.data),
    onSuccess: (profile) => {
      queryClient.setQueryData(["profile"], profile)
      setUser(profile)
    },
  })
}

export function useSetupTwoFactor() {
  return useMutation({ mutationFn: () => authApi.setup2fa().then((response) => response.data) })
}

/**
 * ⚠️ Both of these invalidate the profile, because `twoFactorEnabled` is on it — a screen that did not
 * would go on offering "Set up 2FA" to somebody who had just set it up.
 */
export function useConfirmTwoFactor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ plainTextSecret, verificationCode }: { plainTextSecret: string; verificationCode: string }) =>
      authApi.confirm2fa(plainTextSecret, verificationCode).then((response) => response.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
  })
}

export function useDisableTwoFactor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (password: string) => authApi.disable2fa(password).then((response) => response.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
  })
}

/**
 * Creating an account.
 *
 * ⚠️ **It does not sign anybody in, and must not.** The backend answers with the profile it made, not
 * with a token pair — the address still has to be verified. Storing anything from this response as a
 * session is how an unverified account walks straight in.
 */
export function useRegister() {
  return useMutation({
    mutationFn: (request: RegistrationRequest) => authApi.register(request).then((response) => response.data),
  })
}
