import type { ReactNode } from "react"
import { cn } from "@jmouse/ui"

/**
 * A block of prose the reader is not meant to skim past.
 *
 * ⚠️ **A local one, and it is temporary.** `@jmouse/markdown` ships the real `Callout` and the old
 * interface uses it; that package arrives here under `INVT-0057`. Written small rather than pulled
 * forward, because the alternative was leaving five screens with no way to say *this is the sentence
 * that matters* — and a warning rendered as an ordinary paragraph is a warning nobody read.
 *
 * ⚠️ **Never colour alone.** Each tone carries a glyph, because a reader who cannot tell the amber from
 * the blue would otherwise be told nothing at all about which of the two this is.
 */
export type CalloutTone = "info" | "warning" | "danger" | "success"

const TONES: Record<CalloutTone, { border: string; background: string; glyph: string }> = {
  info: { border: "border-primary/40", background: "bg-primary/5", glyph: "ℹ" },
  warning: { border: "border-warning/40", background: "bg-warning/10", glyph: "⚠" },
  danger: { border: "border-destructive/40", background: "bg-destructive/10", glyph: "⊘" },
  success: { border: "border-success/40", background: "bg-success/10", glyph: "✓" },
}

export function Callout({
  tone = "info",
  children,
  className,
}: {
  tone?: CalloutTone
  children: ReactNode
  className?: string
}) {
  const painted = TONES[tone]

  return (
    <div className={cn("flex gap-2.5 rounded-md border p-3 text-xs", painted.border, painted.background, className)}>
      <span aria-hidden="true" className="shrink-0 text-sm leading-5">
        {painted.glyph}
      </span>
      <div className="flex min-w-0 flex-col gap-2">{children}</div>
    </div>
  )
}
