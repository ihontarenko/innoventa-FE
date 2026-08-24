import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { AuthNotice, AuthShell } from "@/components/auth/AuthShell"
import { authApi } from "@/api/auth"

type Verification = "verifying" | "verified" | "failed"

/**
 * The link out of the sign-up email, landing.
 *
 * ⚠️ **The verification fires in an effect, not while rendering.** The old screen called it from the
 * render body behind an `if (status === 'idle')` guard — which works exactly until React renders twice,
 * and then posts the one-time token twice and shows the second, failing answer. Nothing about the bug is
 * visible in development until it is.
 */
export function EmailVerifyPage() {
  const [searchParameters] = useSearchParams()
  const token = searchParameters.get("token")

  const [verification, setVerification] = useState<Verification>("verifying")

  useEffect(() => {
    if (!token) {
      return
    }

    let abandoned = false

    authApi
      .verifyEmail(token)
      .then(() => {
        if (!abandoned) {
          setVerification("verified")
        }
      })
      .catch(() => {
        if (!abandoned) {
          setVerification("failed")
        }
      })

    return () => {
      abandoned = true
    }
  }, [token])

  return (
    <AuthShell title="Email verification" footer={<Link to="/auth/login">Go to sign in</Link>}>
      {!token && <AuthNotice tone="error">This link carries no verification token.</AuthNotice>}

      {token && verification === "verifying" && <AuthNotice tone="info">Verifying your address…</AuthNotice>}

      {token && verification === "verified" && (
        <AuthNotice tone="success">Verified. You can sign in now.</AuthNotice>
      )}

      {token && verification === "failed" && (
        <AuthNotice tone="error">
          That did not work — the link may have expired, or the address may already be verified. Try
          signing in; if it refuses, ask for a new link.
        </AuthNotice>
      )}
    </AuthShell>
  )
}
