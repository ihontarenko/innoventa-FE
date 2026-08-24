import { useEffect, useLayoutEffect, useRef } from "react"
import { Link, Navigate, Outlet, useLocation } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { Button, Card, CardContent, Skeleton } from "@jmouse/ui"
import { PLATFORM_HOME_PATH, resolveNavigationContext } from "@/lib/navigationContext"
import { useRecordSpaceVisit, useSpaces } from "@/hooks/useSpaces"
import { useSpaceStore } from "@/stores/spaceStore"

/**
 * Whether an error means the backend itself is unreachable — a network drop or a 5xx — as opposed to an
 * ordinary rejection. `http.ts` tags both; a 5xx is accepted defensively as well.
 */
function isBackendDownError(error: unknown): boolean {
  if (!error) {
    return false
  }

  const typedError = error as { isNetworkError?: boolean; isServerError?: boolean; response?: { status?: number } }

  if (typedError.isNetworkError || typedError.isServerError) {
    return true
  }

  const status = typedError.response?.status

  return typeof status === "number" && status >= 500
}

/**
 * A workspace nothing answers to.
 *
 * ⚠️ **Stated plainly rather than papered over.** Redirecting into a different workspace is the exact
 * lie that putting the workspace in the address exists to remove — the reader would be looking at
 * somebody else's data under the link they were sent.
 */
function SpaceNotFound({ slug }: { slug: string }) {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-start gap-3 pt-6">
          <span className="text-3xl">🚪</span>
          <h1 className="font-display text-lg font-semibold tracking-[-0.02em]">
            No such workspace, or you are not a member
          </h1>
          <p className="text-sm text-muted-foreground">
            Nothing you can reach is called <strong>{slug}</strong>. Whoever sent you this link may need to add you to
            it first.
          </p>
          <Button variant="outline" asChild>
            <Link to={PLATFORM_HOME_PATH}>← Back to the hub</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * ⚠️ **A failed load must never read as "you have no workspaces"** — that is how an outage used to
 * masquerade as an empty account.
 */
function BackendUnavailable({ status, onRetry }: { status: number | null; onRetry: () => void }) {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-start gap-3 pt-6">
          <span className="text-3xl">🛠</span>
          <h1 className="font-display text-lg font-semibold tracking-[-0.02em]">Innoventa is not answering</h1>
          <p className="text-sm text-muted-foreground">
            This is the server, not your account{status ? ` — it replied ${status}` : ""}. Your workspaces are where you
            left them.
          </p>
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function LoadingPane() {
  return (
    <div className="flex flex-col gap-3 p-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <Skeleton className="h-4 w-full max-w-md" />
    </div>
  )
}

/**
 * Turns the address into a navigation context, and refuses to render anything underneath it until it
 * has.
 *
 * ⚠️ **That refusal is the whole point.** Every workspace-scoped request carries `X-Space-Id` from the
 * store, so a screen that paints before the address has been resolved sends its first request with
 * whichever workspace the previous navigation left behind — and gets a clean, wrong answer back.
 * Blocking costs one frame on entry; not blocking costs correctness on every shared link.
 */
export function NavigationContextGate() {
  const location = useLocation()
  const queryClient = useQueryClient()

  const { data: spaces = [], isLoading, isError, error } = useSpaces()

  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId)
  const lastVisitedSpaceSlug = useSpaceStore((state) => state.lastVisitedSpaceSlug)
  const enterSpace = useSpaceStore((state) => state.enterSpace)
  const leaveSpace = useSpaceStore((state) => state.leaveSpace)

  const context = resolveNavigationContext({
    pathname: location.pathname,
    search: location.search,
    spaces,
    lastVisitedSpaceSlug,
  })

  const targetSpace = context.space
  const targetSpaceId = targetSpace?.id ?? null
  const inSync = activeSpaceId === targetSpaceId

  // Before paint, so the synchronising render never reaches the screen as a flash.
  useLayoutEffect(() => {
    if (targetSpace) {
      if (activeSpaceId !== targetSpace.id) {
        enterSpace(targetSpace)
      }

      return
    }

    if (activeSpaceId !== null) {
      leaveSpace()
    }
  }, [targetSpace, activeSpaceId, enterSpace, leaveSpace])

  // Everything cached below the workspace was answered for a different one. ⚠️ Only a genuine switch
  // clears it — arriving from the platform context has nothing stale to drop, and clearing there would
  // throw away the hub's own answers on every entry.
  const previousSpaceId = useRef(activeSpaceId)

  useEffect(() => {
    if (previousSpaceId.current === activeSpaceId) {
      return
    }

    const switched = previousSpaceId.current !== null && activeSpaceId !== null
    previousSpaceId.current = activeSpaceId

    if (switched) {
      queryClient.invalidateQueries()
    }
  }, [activeSpaceId, queryClient])

  // ⚠️ One write per entry, not per request: where somebody has been is about arriving in a workspace,
  // and moving between screens inside one is not arriving in it again.
  const { mutate: recordVisit } = useRecordSpaceVisit()
  const recordedSpaceId = useRef<string | null>(null)

  useEffect(() => {
    if (targetSpaceId === null || recordedSpaceId.current === targetSpaceId) {
      return
    }

    recordedSpaceId.current = targetSpaceId
    recordVisit(targetSpaceId)
  }, [targetSpaceId, recordVisit])

  if (isLoading) {
    return <LoadingPane />
  }

  if (isError && isBackendDownError(error)) {
    const status = (error as { response?: { status?: number } })?.response?.status ?? null

    return <BackendUnavailable status={status} onRetry={() => queryClient.refetchQueries()} />
  }

  if (context.redirectTo) {
    return <Navigate to={context.redirectTo} replace />
  }

  // Nowhere to be but the platform context, and the hub is what asks them to make a workspace.
  if (context.kind === "space" && spaces.length === 0) {
    return <Navigate to={PLATFORM_HOME_PATH} replace />
  }

  if (context.unresolvedSpaceSlug) {
    return <SpaceNotFound slug={context.unresolvedSpaceSlug} />
  }

  if (!inSync) {
    return <LoadingPane />
  }

  return <Outlet />
}
