import type { ReactNode } from "react"

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
  return (
    <header className="-mx-4 -mt-4 flex flex-shrink-0 flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b bg-background px-6 pt-[18px] pb-[13px]">
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
      {/* ⚠️ shrink-0 keeps the actions whole; flex-wrap on the header lets them drop to their own line
          when even that will not fit, which is the honest answer at a phone width. */}
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
