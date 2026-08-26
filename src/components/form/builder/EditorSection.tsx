import { useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@jmouse/ui"

/**
 * One group of the field editor, painted as a card.
 *
 * ⚠️ **A card rather than a band across a column, because the editor is now a GRID.** The sections used
 * to be stacked hairline-separated bands inside an 22-rem pane, which is the only shape that works in a
 * narrow column and the worst one in a wide row — four headings a screenful apart, none of them visible
 * together. As cards they tile: on a wide screen Choices, Validation, Condition and Advanced sit side by
 * side and are all readable at once, which is the whole point of editing in place instead of in a pane.
 *
 * ⚠️ **A section that does not apply is not rendered at all** — that is the caller's job. A `TEXT` field
 * simply has no *Choices* card to skip past.
 *
 * ⚠️ **Open by default, `Advanced` excepted.** Collapsing what somebody came to edit costs a click on
 * every single visit; collapsing what they came to edit *rarely* saves a screenful on every visit.
 */
export function EditorSection({
  title,
  icon,
  hint,
  badge,
  defaultOpen = true,
  className,
  children,
}: {
  title: string
  /** A glyph in the heading's tinted square — what the eye lands on when the cards are tiled. */
  icon?: ReactNode
  hint?: string
  /** A short marker in the heading — a count, or a word like `set`. */
  badge?: ReactNode
  defaultOpen?: boolean
  className?: string
  children: ReactNode
}) {
  const [isOpen, setOpen] = useState(defaultOpen)

  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border bg-card/50 transition-colors",
        isOpen && "bg-card",
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setOpen((previous) => !previous)}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-accent/40"
      >
        {icon && (
          <span
            aria-hidden="true"
            className="flex size-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[11px] text-primary"
          >
            {icon}
          </span>
        )}
        <span className="text-[11px] font-semibold tracking-[0.06em] uppercase">{title}</span>
        {badge !== undefined && badge !== null && badge !== false && (
          <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] leading-none text-secondary-foreground">
            {badge}
          </span>
        )}
        {hint && <span className="ml-auto truncate pl-2 text-[11px] text-muted-foreground">{hint}</span>}
        <ChevronDown className={cn("size-3.5 shrink-0 opacity-50 transition-transform", !hint && "ml-auto", isOpen && "rotate-180")} />
      </button>

      {isOpen && <div className="flex flex-col gap-3 border-t px-2.5 py-3">{children}</div>}
    </section>
  )
}

/** A labelled control inside a section — the one place the label/control rhythm is decided. */
export function EditorField({
  label,
  hint,
  htmlFor,
  className,
  children,
}: {
  label?: string
  hint?: ReactNode
  htmlFor?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-[11px] font-medium text-muted-foreground">
          {label}
        </label>
      )}
      {children}
      {hint && <span className="text-[11px] leading-snug text-muted-foreground">{hint}</span>}
    </div>
  )
}
