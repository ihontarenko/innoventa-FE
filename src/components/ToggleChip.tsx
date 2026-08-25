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
        // ⚠️ Sized to stand in a control row, not to be a caption. It was `py-0.5 text-[11px]` — a pill
        // two-thirds the height of the `Input` and `Button size="sm"` it sits beside, so a header row
        // read as a line of controls with one small odd thing in it. `h-8` and `text-sm` are what those
        // two already are; the rounded-full shape is what still says *this one toggles*.
        "inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
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
