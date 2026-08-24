import { Button, cn } from "@jmouse/ui"
import { Callout, type CalloutTone } from "@/components/Callout"
import type { LoadFailure } from "@/lib/loadFailure"

const TONES: Record<LoadFailure["kind"], CalloutTone> = {
  offline: "warning",
  broken: "warning",
  refused: "danger",
  missing: "info",
}

/**
 * What a surface draws in place of the thing that did not arrive.
 *
 * ⚠️ **One component for every surface, because the alternative is a screen that lies quietly.** Left to
 * itself, each place invents its own sentence — and the sentences drift until a 500 in a drawer renders
 * as a skeleton that never ends and the same 500 on a page renders as *you may not open this*. Both were
 * true here, and both are `INVT-0109`.
 *
 * ⚠️ **A retry is offered only where trying again could change the answer.** A button that re-asks a
 * question already answered — you may not, it does not exist — teaches the reader that buttons do
 * nothing.
 */
export function LoadFailureNotice({
  failure,
  onRetry,
  className,
}: {
  failure: LoadFailure
  onRetry?: () => void
  className?: string
}) {
  const canRetry = failure.retryable && !!onRetry

  return (
    <Callout tone={TONES[failure.kind]} className={cn("max-w-xl", className)}>
      <p className="text-sm font-medium">{failure.title}</p>
      {failure.detail && <p className="text-muted-foreground">{failure.detail}</p>}

      {canRetry && (
        <div>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </Callout>
  )
}
