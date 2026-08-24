import { useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { AuthNotice, AuthShell } from "@/components/auth/AuthShell"
import { authApi } from "@/api/auth"
import { useAuthStore } from "@/stores/authStore"

/**
 * Where the emailed sign-in link lands — and, until this file, **nowhere**.
 *
 * ⚠️ **The old interface never had this screen.** `EmailTokenService` mails
 * `<baseUrl>/auth/magic-link/verify?token=…`, which is an address in the *frontend*, and the old router
 * has no route for it: every magic link ever sent fell through to the catch-all. The API client even
 * carried a `verifyMagicLink` that nothing called. The feature was half-built and looked finished from
 * both ends — the backend mints and redeems tokens correctly, the request screen says the right
 * sentence, and the one thing missing was in neither of them.
 *
 * ⚠️ **Redeeming signs somebody in, so it happens once, in an effect.** The token is single-use: a
 * second post spends nothing and reports failure, which would turn a working link into a broken one.
 */
export function MagicLinkVerifyPage() {
  const [searchParameters] = useSearchParams()
  const navigate = useNavigate()
  const { setTokens, setUser } = useAuthStore()

  const token = searchParameters.get("token")
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!token) {
      return
    }

    let abandoned = false

    authApi
      .verifyMagicLink(token)
      .then(({ data }) => {
        if (abandoned) {
          return
        }

        if (!data.accessToken || !data.refreshToken) {
          setFailed(true)

          return
        }

        setTokens(data.accessToken, data.refreshToken)

        if (data.user) {
          setUser(data.user)
        }

        navigate("/hub", { replace: true })
      })
      .catch(() => {
        if (!abandoned) {
          setFailed(true)
        }
      })

    return () => {
      abandoned = true
    }
  }, [token, setTokens, setUser, navigate])

  return (
    <AuthShell title="Signing you in" footer={<Link to="/auth/magic-link">Ask for a new link</Link>}>
      {!token && <AuthNotice tone="error">This link carries no token.</AuthNotice>}

      {token && !failed && <AuthNotice tone="info">One moment — redeeming your link…</AuthNotice>}

      {token && failed && (
        <AuthNotice tone="error">
          That link did not work. Sign-in links expire quickly and can only be used once — ask for a fresh
          one.
        </AuthNotice>
      )}
    </AuthShell>
  )
}
