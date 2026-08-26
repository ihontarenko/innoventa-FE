import type { ReactNode } from "react"
import { cn } from "@jmouse/ui"

/**
 * One block of the record's rail.
 *
 * ⚠️ **A panel is drawn only where the record can carry what it holds.** An empty "Stock" over a
 * drawing would be the same lie as a row of dashes, one level up — see `entryCapabilities`.
 */
export function EntryPanel({
  title,
  count,
  action,
  className,
  children,
}: {
  title: string
  /** A number worth seeing without opening it — how many files, how many links. */
  count?: number
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn("overflow-hidden rounded-lg border bg-card", className)}>
      <header className="flex items-center gap-2 px-3 pt-2.5 pb-2">
        <span className="flex-1 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          {title}
        </span>
        {count !== undefined && (
          <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
        )}
        {action}
      </header>

      <div className="flex flex-col gap-2 px-3 pb-3">{children}</div>
    </section>
  )
}

/**
 * A fact this record *can* hold and nobody has filled in.
 *
 * ⚠️ **Drawn as an action, because that is the only thing anybody can do with it.** The whole point of
 * telling *unfilled* apart from *absent* is that one of them is somebody's next move.
 */
export function EntryGap({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  )
}

/** One label-and-value line, for the rail's tighter measure. */
export function EntryLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="min-w-0 truncate text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{children}</span>
    </div>
  )
}
