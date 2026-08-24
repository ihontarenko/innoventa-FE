import type { ReactNode } from "react"
import { cn } from "@jmouse/ui"

/**
 * How a dialog stays inside the window.
 *
 * ⚠️ **Any dialog whose body can grow needs BOTH halves of this, and each alone is its own bug.**
 * - `max-h` with nothing scrolling inside **clips silently** — the footer is simply gone, no scrollbar
 *   appears, and there is no way to reach the button that finishes the task.
 * - Scrolling with no `max-h` never triggers: the content is as tall as it wants, so the dialog centres
 *   itself on something taller than the screen and puts its own title off the top edge. Radix locks the
 *   page behind it, so nothing scrolls at all.
 *
 * ⚠️ **`svh`, not `vh`.** On a phone `vh` is measured against the *largest* viewport — the one with the
 * browser chrome retracted — so an 85vh dialog is taller than the screen actually showing it whenever
 * the address bar is visible, which is most of the time.
 *
 * ⚠️ **A dialog that is a short fixed form does not need this.** Bounding a four-field form buys nothing
 * and costs a scroll container that eats focus rings at its edges.
 */
export const BOUNDED_DIALOG = "flex max-h-[85svh] flex-col"

/**
 * The part of a bounded dialog that scrolls — everything between the header and the footer.
 *
 * ⚠️ **`min-h-0` is not decoration.** A flex child's default `min-height: auto` refuses to shrink below
 * its content, so `flex-1 overflow-y-auto` without it grows the dialog instead of scrolling inside it —
 * the exact bug this component exists to prevent, wearing the clothes of the fix.
 *
 * ⚠️ **The negative margin cancels the padding.** A scroll container clips at its own edge, which would
 * shave the focus ring off every control sitting flush against it; the padding gives the ring room and
 * the margin gives the width back.
 */
export function DialogBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("-mx-1 min-h-0 flex-1 overflow-y-auto px-1", className)}>{children}</div>
}
