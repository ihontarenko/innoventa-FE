import { useState, type ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@jmouse/ui"

/**
 * One collapsible group of the field editor.
 *
 * ⚠️ **A section that does not apply is not rendered at all** — that is the caller's job, and it is
 * what makes this shape more compact than the five permanent tabs it replaces. A `TEXT` field simply
 * has no *Choices* heading to skip past.
 *
 * ⚠️ **Open by default, `Advanced` excepted.** Collapsing what somebody came to edit costs a click on
 * every single visit; collapsing what they came to edit *rarely* saves a screenful on every visit.
 */
export function EditorSection({
  title,
  hint,
  badge,
  defaultOpen = true,
  children,
}: {
  title: string
  hint?: string
  /** A short marker in the heading — a count, or a word like `set`. */
  badge?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [isOpen, setOpen] = useState(defaultOpen)

  return (
    <section className="border-b last:border-b-0">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setOpen((previous) => !previous)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-accent/40"
      >
        <ChevronRight className={cn("size-3.5 shrink-0 transition-transform", isOpen && "rotate-90")} />
        <span className="text-xs font-semibold tracking-[0.04em] uppercase">{title}</span>
        {badge && <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] leading-none">{badge}</span>}
        {hint && <span className="ml-auto truncate text-xs text-muted-foreground">{hint}</span>}
      </button>

      {isOpen && <div className="flex flex-col gap-3 px-4 pt-1 pb-4">{children}</div>}
    </section>
  )
}

/** A labelled control inside a section — the one place the label/control rhythm is decided. */
export function EditorField({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium">
        {label}
      </label>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}
