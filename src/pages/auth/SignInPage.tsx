import { useState, type FormEvent } from "react"
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom"
import { Button, Input, Label } from "@jmouse/ui"
import { AuthNotice, AuthShell } from "@/components/auth/AuthShell"
import { authApi } from "@/api/auth"
import { useSignIn } from "@/hooks/useProfile"
import { usePublicConfiguration } from "@/hooks/useSystemSettings"
import { useAuthStore } from "@/stores/authStore"

/**
 * ⚠️ **Innoventa signs itself in.** Tessera and Kiwi hand this screen to Identity; this backend mints
 * its own pair at `/api/auth/login` and runs its own OAuth2 hand-off at `/oauth2/authorization/*`, so
 * the form is real rather than a redirect. The decision and its reasoning are on `INVT-0052`.
 */
export function SignInPage() {
  const location = useLocation()
  const [searchParameters] = useSearchParams()

  const isAuthenticated = useAuthStore((state) => !!state.accessToken)
  const pendingToken = useAuthStore((state) => state.pendingToken)
  const { setTokens, setUser, clearPendingToken } = useAuthStore()

  const signIn = useSignIn()
  const { data: configuration } = usePublicConfiguration()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [secondFactorError, setSecondFactorError] = useState<string | null>(null)

  if (isAuthenticated) {
    const intended = (location.state as { from?: string } | null)?.from

    return <Navigate to={intended ?? "/hub"} replace />
  }

  const registrationClosed = configuration?.["auth.close_registration"] === "true"
  const invitationsRequired = configuration?.["auth.invitation_system"] === "true"
  const mayRegister = !registrationClosed || invitationsRequired

  function submitCredentials(event: FormEvent) {
    event.preventDefault()
    signIn.mutate({ email, password })
  }

  async function submitSecondFactor(event: FormEvent) {
    event.preventDefault()
    setSecondFactorError(null)

    try {
      const { data } = await authApi.verifyTwoFactor(pendingToken!, code)

      if (data.accessToken && data.refreshToken) {
        setTokens(data.accessToken, data.refreshToken)
      }

      if (data.user) {
        setUser(data.user)
      }

      clearPendingToken()
    } catch {
      setSecondFactorError("That code was not accepted. Codes expire quickly — try the current one.")
    }
  }

  if (pendingToken) {
    return (
      <AuthShell title="One more step" subtitle="Enter the code from your authenticator.">
        <form className="flex flex-col gap-4" onSubmit={submitSecondFactor}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="code">Verification code</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>

          {secondFactorError && <AuthNotice tone="error">{secondFactorError}</AuthNotice>}

          <Button type="submit" disabled={code.length === 0}>
            Confirm
          </Button>
          <Button type="button" variant="ghost" onClick={() => clearPendingToken()}>
            Start over
          </Button>
        </form>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Innoventa — forms, inventory, entries."
      footer={
        mayRegister ? (
          <>
            No account yet? <Link to="/auth/register">Create one</Link>
          </>
        ) : undefined
      }
    >
      <form className="flex flex-col gap-4" onSubmit={submitCredentials}>
        {/* ⚠️ The provider hand-off failing comes back as an address, not as a rejected promise — the
            callback screen has nowhere to put an error, so it hands it here. */}
        {searchParameters.get("error") === "oauth2_failed" && (
          <AuthNotice tone="error">That sign-in did not complete. Try again, or use your password.</AuthNotice>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <Label htmlFor="password">Password</Label>
            <Link to="/auth/magic-link" className="text-xs text-muted-foreground hover:text-foreground">
              Sign in without one
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {signIn.isError && (
          <AuthNotice tone="error">That email and password did not match an account.</AuthNotice>
        )}

        <Button type="submit" disabled={signIn.isPending || !email || !password}>
          {signIn.isPending ? "Signing in…" : "Sign in"}
        </Button>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or continue with
          <span className="h-px flex-1 bg-border" />
        </div>

        {/* Real navigations, not fetches: the provider hand-off is a redirect the backend owns, and an
            XHR to it would follow the redirect and land the HTML in a promise. */}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" asChild>
            <a href="/oauth2/authorization/google">Google</a>
          </Button>
          <Button type="button" variant="outline" asChild>
            <a href="/oauth2/authorization/github">GitHub</a>
          </Button>
        </div>
      </form>
    </AuthShell>
  )
}
