import type { ReactNode } from "react"
import { cn } from "@jmouse/ui"

/**
 * One pane of the management screen — a heading, a sentence, and the controls.
 *
 * ⚠️ **Panes rather than a column of collapsibles** (Ivan, 2026-08-25). The old shape stacked every
 * group as an accordion band, so the answer to "is this form shared?" was two scrolls and a click away,
 * and the sections a reader was not asking about still cost them screen. A rail names all six at once
 * and carries each one's state as a badge; what is on screen is the one thing being changed.
 */
export function Pane({
  title,
  hint,
  children,
  className,
}: {
  title: string
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <header className="flex flex-col gap-0.5">
        <h3 className="font-display text-sm font-semibold">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </header>
      {children}
    </section>
  )
}

/**
 * A labelled control inside a pane.
 *
 * ⚠️ **`wide` is a layout decision the CALLER owns**, because only it knows whether the control is a
 * select the width of a thumb or a chip list of forty fields. A grid that guessed would put a row of
 * chips in a half-column and wrap it into six lines.
 */
export function PaneField({
  label,
  hint,
  wide = false,
  children,
}: {
  label: string
  hint?: ReactNode
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", wide && "sm:col-span-2")}>
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <span className="text-[11px] leading-snug text-muted-foreground">{hint}</span>}
    </div>
  )
}

/** The two-up grid every pane lays its small controls out on. */
export function PaneGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-3 sm:grid-cols-2", className)}>{children}</div>
}

/**
 * A short sentence about a switch, beside it.
 *
 * ⚠️ The whole row is the label, so the words toggle the switch — a switch whose only target is the
 * switch itself is a 20-pixel hit area for a sentence-long decision.
 */
export function PaneSwitchRow({
  control,
  title,
  hint,
}: {
  control: ReactNode
  title: string
  hint?: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md border bg-muted/30 p-2.5">
      <span className="pt-0.5">{control}</span>
      <span className="text-xs">
        {title}
        {hint && <span className="mt-0.5 block leading-snug text-muted-foreground">{hint}</span>}
      </span>
    </label>
  )
}
