import type { ReactNode } from "react"
import { cn } from "@jmouse/ui"

/**
 * One small thing that is either chosen or not.
 *
 * ⚠️ **A chip rather than a checkbox, and that is what makes eighty-nine of them readable.** Chips wrap,
 * so a field of them is seven rows a reader scans; the same set as checkboxes is eighty-nine rows and a
 * scroll box around them. The count belongs in the heading above, never on each chip.
 */
export function ToggleChip({
  active,
  disabled,
  title,
  onClick,
  children,
  className,
}: {
  active: boolean
  disabled?: boolean
  title?: string
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        // ⚠️ EXACTLY `Button size="sm"` — 30px, 12.5px, `rounded-md`. Nothing about it is its own.
        //
        // It was `py-0.5 text-[11px]`, then `h-8 text-sm`, then 30px with `rounded-full` kept on the
        // argument that the pill said *this one toggles*. It did not say that. Beside a field and a
        // button of the same height it said *this came from somewhere else* — the one difference left
        // was the one everybody could see, and it read as an accident rather than as a meaning.
        //
        // What says a chip is toggled is `aria-pressed` and the filled state below. A radius carries no
        // information that those two do not already carry, and it costs the row its evenness.
        "inline-flex h-[30px] items-center rounded-md border px-3 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        className,
      )}
    >
      {children}
    </button>
  )
}
