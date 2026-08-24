import { useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Skeleton } from "@jmouse/ui"
import { publicSharingApi } from "@/api/sharing"
import { useAuthStore } from "@/stores/authStore"
import { PublicNotice, PublicSurface } from "@/components/public/PublicSurface"
import { PublicEntryPage } from "./PublicEntryPage"
import { PublicFormPage } from "./PublicFormPage"

/**
 * The catch-all for pretty CUSTOM addresses — `/shared-page/component-manual`, and anything else an
 * administrator has minted a pattern for.
 *
 * ⚠️ **It renders the resource in place; it does not redirect to it.** The whole point of a custom path
 * is that it is the address somebody shares, so bouncing to `/_/form/{40 characters of token}` would
 * replace the pretty link in the address bar the moment it was opened. The token is used, never shown.
 *
 * ⚠️ **An unresolvable address is a 404, not a bounce home.** This is the application's only catch-all,
 * so it catches mistyped in-app routes as well as dead share links — and sending either to the hub
 * throws the address away before the reader can read it, which makes a typo look exactly like a page
 * somebody deleted.
 */
export function PrettyUrlPage() {
  const location = useLocation()
  const isAuthenticated = useAuthStore((state) => !!state.accessToken)
  const path = location.pathname.replace(/^\/+/, "")

  const { data: resolution, isLoading, isError } = useQuery({
    queryKey: ["pretty-url", path],
    queryFn: () => publicSharingApi.resolve(path).then((response) => response.data),
    enabled: !!path,
    retry: false,
  })

  useEffect(() => {
    if (resolution?.mode === "REDIRECT" && resolution.targetUrl) {
      window.location.replace(resolution.targetUrl)
    }
  }, [resolution])

  if (!path || isError) {
    // ⚠️ **Two different answers, because they are two different people.** A signed-in reader who lands
    // here has almost certainly hit a screen the port has not reached yet, and telling them the old
    // interface still answers it is actionable. A stranger following a link has no old interface, no
    // account and nothing to do with that sentence — and must not be told which of "revoked", "expired"
    // and "never existed" is the case.
    // ⚠️ **On the public surface, not on `PlaceholderPage`.** That component is a *section* placeholder
    // and is built for the workspace shell — its `PageHeader` carries `-mx-4 -mt-4`, negative margins
    // that cancel the shell's own padding. This route is outside every layout by design (a stranger
    // following a shared link must reach it), so rendered bare those margins pulled the header past the
    // left edge and gave the whole document a horizontal scrollbar, over a page with no padding, no
    // sidebar and no way back.
    if (isAuthenticated) {
      return (
        <PublicSurface>
          <PublicNotice icon="🧭" title="Nothing here">
            This address belongs to a screen that has not been ported yet, or to nothing at all. The old
            interface still answers it.
          </PublicNotice>

          {/* ⚠️ A signed-in reader who lands on a dead address has nothing else on screen to click. */}
          <p className="mt-6 text-center text-sm">
            <Link to="/hub" className="underline underline-offset-2 hover:text-foreground">
              Back to your workspaces
            </Link>
          </p>
        </PublicSurface>
      )
    }

    return (
      <PublicSurface>
        <PublicNotice icon="🧭" title="Nothing at this address">
          This link does not lead anywhere. It may have been mistyped, or the thing it pointed at may no
          longer be shared.
        </PublicNotice>
      </PublicSurface>
    )
  }

  if (isLoading || !resolution) {
    return (
      <PublicSurface>
        <Skeleton className="h-40 w-full" />
      </PublicSurface>
    )
  }

  if (resolution.mode === "RENDER_IN_PLACE" && resolution.shareToken) {
    const token = resolution.shareToken

    switch (resolution.resourceType) {
      case "FORM":
        return <PublicFormPage shareToken={token} />

      case "ENTRY":
        return <PublicEntryPage shareToken={token} />

      /**
       * ⚠️ **A type this build cannot draw is said out loud, not redirected into.** `PAGE` and
       * `CATEGORY` are parked pending the move to Kiwi (`KW-13`) and `FILE` waits on the endpoint
       * migration — so `publicRouteFor` would send the reader to a `/_/…` address that has no route,
       * which lands back on this very component, fails to re-resolve the rewritten path, and tells
       * somebody holding a **perfectly good link** that it leads nowhere. It resolved fine; the
       * interface simply has not caught up.
       *
       * ⚠️ It also rewrote the address bar on the way, so the pretty link the reader was given is gone
       * by the time they read the wrong explanation.
       */
      default:
        return (
          <PublicSurface>
            <PublicNotice icon="🚧" title="Not in this interface yet">
              This link works — it points at{" "}
              <strong>{resolution.resourceType.toLowerCase()}</strong> content, which the new interface
              does not carry yet. The old one still opens it.
            </PublicNotice>
          </PublicSurface>
        )
    }
  }

  return (
    <PublicSurface>
      <Skeleton className="h-40 w-full" />
    </PublicSurface>
  )
}
