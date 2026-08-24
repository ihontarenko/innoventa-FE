import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Alert, AlertDescription, Button, Skeleton } from "@jmouse/ui"
import { identityUserManager } from "@/auth/identityAuth"

/**
 * Where Identity sends the browser back after the **second** sign-in (INVT-0097).
 *
 * <h2>⚠️ `/auth/identity/callback`, and NOT `/login/oauth2/code/identity`</h2>
 *
 * Every other interface here uses the latter, and copying it would have been silently broken:
 * `vite.config.ts` proxies `/login` to **Innoventa's own backend**, which owns that path for its
 * Google and GitHub sign-ins. The callback would have left the SPA entirely and landed on a server that
 * knows nothing about this flow — and the failure would have read as Identity misbehaving.
 *
 * ⚠️ So the path is this product's, and Identity's `identity.clients.innoventa.redirect-uris` names it
 * exactly. OAuth matches the redirect URI literally: the two must be changed together or nobody can
 * sign in at all.
 *
 * <h2>⚠️ It returns to where the person was, not to a home page</h2>
 *
 * They pressed a button on the pages screen; landing anywhere else makes the connection feel like it
 * failed. The state carried through the flow is what remembers it.
 */
export function IdentityCallbackPage() {
  const navigate = useNavigate()
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    identityUserManager
      .signinRedirectCallback()
      .then((user) => {
        const returnTo = typeof user.state === "string" && user.state.startsWith("/") ? user.state : "/"

        navigate(returnTo, { replace: true })
      })
      .catch((error: unknown) => {
        // ⚠️ Said out loud rather than bounced back to the button. A silent return to "connect Identity"
        // is a screen that looks like the click did nothing, and the second attempt fails the same way.
        setFailure(error instanceof Error ? error.message : "The sign-in could not be completed.")
      })
  }, [navigate])

  if (failure !== null) {
    return (
      <div className="mx-auto max-w-xl space-y-3 px-6 py-16">
        <Alert variant="destructive">
          <AlertDescription>
            Identity could not complete the connection: {failure}
          </AlertDescription>
        </Alert>
        <Button type="button" variant="outline" onClick={() => navigate("/", { replace: true })}>
          Back
        </Button>
      </div>
    )
  }

  return <Skeleton className="mx-auto mt-16 h-24 w-full max-w-xl" />
}
