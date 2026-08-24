import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { Badge, cn } from "@jmouse/ui"
import type { PageBlockStatus } from "@/api/blocks"

/**
 * The frame every resolved live block shares.
 *
 * ⚠️ **A card, not prose.** A live block is the one thing in a page that is *not* what somebody typed —
 * it has to look like a reading taken at open time, or the reader has no way to tell which numbers are
 * from March and which are from now.
 */
export function BlockCard({
  kind,
  headline,
  headlineHref,
  trailing,
  children,
}: {
  kind: string
  headline: ReactNode
  headlineHref?: string
  trailing?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="my-3 flex flex-col gap-2 rounded-md border bg-muted/30 p-3 text-sm not-prose">
      <div className="flex flex-wrap items-baseline gap-2">
        <Badge variant="secondary" className="shrink-0 text-[10px] tracking-[0.06em] uppercase">
          {kind}
        </Badge>

        {headlineHref ? (
          <Link to={headlineHref} className="font-mono font-medium hover:underline">
            {headline}
          </Link>
        ) : (
          <span className="font-mono font-medium">{headline}</span>
        )}

        {trailing && <span className="ml-auto shrink-0">{trailing}</span>}
      </div>

      {children}
    </div>
  )
}

/** ⚠️ Omitted entirely when empty — a row of dashes teaches the reader the block is mostly blank. */
export function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) {
    return null
  }

  return (
    <>
      <dt className="text-[10px] tracking-[0.05em] text-muted-foreground uppercase">{label}</dt>
      <dd className="mb-1 text-sm">{value}</dd>
    </>
  )
}

export function FactList({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-0">{children}</dl>
}

export function BlockSkeleton({ name, argument }: { name: string; argument: string }) {
  return (
    <div className="my-3 animate-pulse rounded-md border border-dashed p-3 not-prose">
      <span className="font-mono text-xs text-muted-foreground">
        :::{name} {argument}
      </span>
    </div>
  )
}

/**
 * The not-resolved states — **shown, never hidden**.
 *
 * ⚠️ **A block that silently disappears reads as "nothing to report", which is a lie** about a document
 * whose whole promise is that its numbers are current. `RESTRICTED` is a public view withholding
 * operational data and says so; the rest are misses and say that instead.
 */
export function BlockNotice({
  name,
  argument,
  status,
}: {
  name: string
  argument: string
  status: PageBlockStatus
}) {
  const isRestricted = status === "RESTRICTED"

  return (
    <div
      className={cn(
        "my-3 flex flex-wrap items-baseline gap-2 rounded-md border border-dashed p-2.5 text-xs not-prose",
        isRestricted ? "border-primary/40 bg-primary/5" : "border-muted-foreground/30 bg-muted/30",
      )}
    >
      <Badge variant="outline" className="shrink-0">
        {isRestricted ? "restricted" : status === "AMBIGUOUS" ? "ambiguous" : "not found"}
      </Badge>

      <span className="text-muted-foreground">
        <code className="font-mono">
          :::{name} {argument}
        </code>
        {isRestricted
          ? " — live data is hidden on the public view. Sign in to see it."
          : status === "AMBIGUOUS"
            ? " — several things match; be more specific."
            : " — nothing matches this reference any more."}
      </span>
    </div>
  )
}

/** `INTEGRATED_CIRCUIT` → `Integrated circuit`. */
export function formatConstant(value: string | null): string | null {
  if (!value) {
    return null
  }

  const spaced = value.replace(/_/g, " ").toLowerCase()

  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * ⚠️ **Three states, not two.** `ACTIVE` is good news, `UNKNOWN` is *absence* of news, and everything
 * else — end-of-life, not recommended for new designs — is a warning. Painting the last two alike is how
 * a part nobody has checked comes to look discontinued.
 */
export function lifecycleTone(lifecycle: string): string {
  if (lifecycle === "ACTIVE") {
    return "text-emerald-600 dark:text-emerald-400"
  }

  if (lifecycle === "UNKNOWN") {
    return "text-muted-foreground"
  }

  return "text-amber-600 dark:text-amber-400"
}
