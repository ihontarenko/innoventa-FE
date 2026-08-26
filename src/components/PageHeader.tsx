import type { ReactNode } from "react"
import { createPortal } from "react-dom"
import { usePageHeaderSlot } from "@/components/layout/PageHeaderSlot"

interface PageHeaderProperties {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

// The same header the old interface draws (components/ui/shared.tsx over ui.module.css's
// .topbar/.topbarTitles/.crumbs/.topbarActions) exactly: 18px/24px/13px padding, an 18px/600/-0.02em
// title with a 12px muted subtitle 2px below it, border-bottom.
//
// ⚠️ The -mx-4 -mt-4 makes this component USABLE ONLY inside that wrapper. Rendered anywhere else the
// negative margins have nothing to cancel and pull the header past the left edge, giving the document a
// horizontal scrollbar — see INVT-0105, where the catch-all route did exactly that.
//
// The -mx-4 -mt-4 cancels ApplicationLayout's content wrapper's own p-4 (this is always that
// wrapper's first child) so the border-bottom — and the header's own background — reach the true
// left/right/top edges the way Innoventa's .topbar does (it sits outside any padded container
// entirely). px-6/pt-[18px]/pb-[13px] then re-establish Innoventa's own inset from those true edges,
// so the title/actions land in the same visual position regardless of the cancel-and-reapply.
export function PageHeader({ title, description, actions }: PageHeaderProperties) {
  // ⚠️ **A screen inside a rail renders its header somewhere else, and nothing about the header
  // changes.** The margins above are what make it usable only as the content box's first child, and a
  // rail puts the page one grid cell to the right — so a layout that has a rail offers a slot back at
  // that first-child position and this portals into it. Same markup, same rules, right box to cancel.
  // No slot means no portal, which is every screen that has ever rendered one. See `PageHeaderSlot`.
  const slot = usePageHeaderSlot()

  const header = (
    <header className="-mx-4 -mt-4 flex flex-shrink-0 flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b bg-background px-4 pt-[18px] pb-[13px] sm:px-6">
      {/* ⚠️ min-w-0 so a long, user-typed title truncates instead of pushing the actions off the right
          edge. Every Button in @jmouse/ui is shrink-0 whitespace-nowrap, so without this the actions
          win the width fight and the primary one — Save, Edit — is the half that leaves the screen.
          There is nowhere to scroll to it either: the app's only scroller is vertical, inside a
          SidebarInset that is overflow-hidden. */}
      <div className="min-w-0">
        {typeof title === "string" ? (
          <h1 className="truncate font-display text-lg font-semibold tracking-[-0.02em]">{title}</h1>
        ) : (
          title
        )}
        {description && <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>}
      </div>
      {/* ⚠️ **Dropping to its own line is not enough — the line itself has to fit.** `shrink-0` kept the
          actions whole, and `flex-wrap` above let them wrap under the title; both were true and the
          buttons still left the screen, because a wrapped flex item is offered the line's width and
          `shrink-0` refuses it. A search field written `w-64` plus a Button (every one of them
          `shrink-0 whitespace-nowrap`) is ~400px of refusal on a 375px phone, and there is nowhere to
          scroll to the remainder: the application's only scroller is vertical, inside an
          overflow-hidden SidebarInset. So the row is full-width and shrinkable below `sm`, and goes
          back to being an unshrinkable cluster at the right from `sm` up.

          ⚠️ The `data-slot=input` rule is what makes that fit look deliberate rather than ragged. Left
          alone, wrapping happens before shrinking, so the field keeps its 256px and the primary
          button drops to a third line by itself. `flex-1` re-bases the field on the space actually
          left over — it already carries `min-w-0` — so field and button share one line. Fields only:
          buttons must never be stretched to fill. */}
      {actions && (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 [&>[data-slot=input]]:flex-1 sm:w-auto sm:shrink-0 sm:[&>[data-slot=input]]:flex-none">
          {actions}
        </div>
      )}
    </header>
  )

  return slot ? createPortal(header, slot) : header
}
