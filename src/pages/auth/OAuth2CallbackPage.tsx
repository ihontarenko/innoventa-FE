import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { AuthShell } from "@/components/auth/AuthShell"
import { authApi } from "@/api/auth"
import { useAuthStore } from "@/stores/authStore"

/**
 * Where Google and GitHub send somebody back to.
 *
 * ⚠️ **An effect, not `useState(() => …)`.** The old screen fired the exchange from a state
 * initialiser — a documented way to run something once, and a wrong one: the initialiser is not a place
 * side effects are guaranteed to run exactly once, and a one-time authorisation code posted twice fails
 * the second time and lands the person back on the sign-in page with `error=oauth2_failed` after a
 * hand-off that actually worked.
 *
 * ⚠️ **Nothing here is rendered for long enough to read**, which is why it says four words and no more.
 * Every ending navigates away; the only reason there is a screen at all is that the round trip is not
 * instant.
 */
export function OAuth2CallbackPage() {
  const navigate = useNavigate()
  const [searchParameters] = useSearchParams()
  const { setTokens, setUser } = useAuthStore()

  const code = searchParameters.get("code")

  useEffect(() => {
    if (!code) {
      navigate("/auth/login?error=oauth2_failed", { replace: true })

      return
    }

    let abandoned = false

    authApi
      .exchangeOAuth2Code(code)
      .then(({ data }) => {
        setTokens(data.accessToken, data.refreshToken)

        return authApi.getProfile()
      })
      .then(({ data }) => {
        if (abandoned) {
          return
        }

        setUser(data)
        navigate("/hub", { replace: true })
      })
      .catch(() => {
        if (!abandoned) {
          navigate("/auth/login?error=oauth2_failed", { replace: true })
        }
      })

    return () => {
      abandoned = true
    }
  }, [code, navigate, setTokens, setUser])

  return (
    <AuthShell title="Completing sign-in">
      <p className="text-sm text-muted-foreground">One moment.</p>
    </AuthShell>
  )
}
