import { cn } from "@jmouse/ui"
import type { PermissionSourceView } from "@/api/access"
import { GrantOriginBadge } from "./GrantOriginBadge"

/**
 * One rule, and where it is kept.
 *
 * ⚠️ **Every line names its home.** The merge is invisible by design, so an unlabelled line is a line
 * whose home the reader has to guess — and the guess that gets made is *the database*, which sends
 * whoever wrote a grant in the policy editor looking for a row that was never going to be there.
 */
export function SourceLine({
  source,
  removed,
  onOverride,
}: {
  source: PermissionSourceView
  removed: boolean
  onOverride?: () => void
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 text-xs", removed && "text-muted-foreground line-through")}>
      <span className={cn(!removed && "text-foreground")}>
        {removed ? "✗" : "✓"} {source.summary}
      </span>

      <GrantOriginBadge origin={source.origin} />

      {/* The sixth axis, and the only one that can make a permission held here and refused on the next
          row. Left unsaid, it reads as unconditional — which is the wrong half. */}
      {source.condition && <span className="font-mono text-[11px] text-warning">when {source.condition}</span>}

      {source.grantedBy && <span className="text-muted-foreground">by {source.grantedBy}</span>}
      {source.reason && <span className="text-muted-foreground italic">“{source.reason}”</span>}
      {source.since && <span className="font-mono text-muted-foreground">{source.since.slice(0, 10)}</span>}

      {/* ⚠️ **A denial, composed and shown — never applied from here.** Deleting the grant is possible
          now that a grant lives in one place, and is still the wrong move from this screen: a rule that
          came from somewhere structural comes back the next time that structure is seeded, and a reader
          who cannot see why a power vanished has been given exactly the mystery this screen exists to
          end. So this drops a readable `deny` into the document unsaved, and it goes through the
          rehearsal like any other change. */}
      {onOverride && (
        <button
          type="button"
          onClick={onOverride}
          className="rounded border px-1.5 py-0.5 text-[10px] hover:bg-accent"
          title="Compose a deny for this in the document. It is not saved yet — deny wins over the grant, visibly, once you review and apply it."
        >
          override
        </button>
      )}
    </div>
  )
}
