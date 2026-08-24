import { useEffect, useState } from "react"
import { Button } from "@jmouse/ui"
import { useEndImpersonation } from "@/hooks/useAdministration"
import { useImpersonationStore } from "@/stores/impersonationStore"

/**
 * Names the account being worked as, for the whole session.
 *
 * ⚠️ **Not dismissible.** The one failure this feature can produce is an administrator forgetting whose
 * data is on the screen and treating it as their own, so the banner has no close button — leaving the
 * session is the only way to make it go away, which is exactly the action it wants to be easier than
 * staying.
 *
 * It counts down rather than only naming a time. "Ends in 4 min" is a thing somebody reads and acts on;
 * an expiry timestamp is a thing somebody has to do arithmetic on and therefore does not.
 */
export function ImpersonationBanner() {
  const session = useImpersonationStore((state) => state.session)
  const end = useEndImpersonation()

  const remaining = useRemainingTime(session?.expiresAt ?? null)

  if (!session) {
    return null
  }

  return (
    <div role="status" className="flex flex-wrap items-center gap-2 bg-warning px-4 py-1.5 text-xs text-background">
      <span aria-hidden="true">◉</span>

      <span>
        Working as <strong>{session.targetName}</strong>
        {session.targetEmail && <span className="opacity-80"> · {session.targetEmail}</span>}
      </span>

      <span className="ml-auto font-mono">{remaining}</span>

      <Button variant="outline" size="sm" disabled={end.isPending} onClick={() => end.mutate()}>
        {end.isPending ? "Leaving…" : "Leave session"}
      </Button>
    </div>
  )
}

/**
 * How long is left, recomputed every second.
 *
 * Expiry is not enforced here — the token's own lifetime does that, and the HTTP client puts the
 * administrator back when the first request past it comes back 401. What this shows is only what a
 * person needs to decide whether to finish or leave.
 */
function useRemainingTime(expiresAt: string | null) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!expiresAt) {
      return
    }

    const ticker = window.setInterval(() => setNow(Date.now()), 1000)

    return () => window.clearInterval(ticker)
  }, [expiresAt])

  if (!expiresAt) {
    return ""
  }

  const millisecondsLeft = new Date(expiresAt).getTime() - now

  if (millisecondsLeft <= 0) {
    return "Expired"
  }

  const minutes = Math.floor(millisecondsLeft / 60_000)
  const seconds = Math.floor((millisecondsLeft % 60_000) / 1000)

  return minutes > 0 ? `Ends in ${minutes} min` : `Ends in ${seconds}s`
}
