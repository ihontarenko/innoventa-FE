import { Outlet } from "react-router-dom"
import { ShortcutHelp, SidebarInset, SidebarProvider, SidebarTrigger } from "@jmouse/ui"
import { ApplicationSidebar } from "@/components/layout/ApplicationSidebar"
import { ImpersonationBanner } from "@/components/layout/ImpersonationBanner"
import { SeasonalEffect } from "@/components/layout/SeasonalEffect"

/**
 * No persistent desktop header — the old `AppLayout` has none either. Sign-out lives in the sidebar
 * footer and a page's title on the page, so content starts flush at the top. The trigger below is
 * mobile-only, mirroring the old `.mobileTopbar`, which is the only bar that layout ever had.
 */
export function ApplicationLayout() {
  return (
    <SidebarProvider>
      <SeasonalEffect />
      {/* ⚠️ Mounted once, here, and it registers `?` itself. The list it prints is generated from
          whatever the screen underneath has registered, so a screen gains a help entry by declaring a
          shortcut and cannot gain one any other way. */}
      <ShortcutHelp />
      <ApplicationSidebar />
      {/* ⚠️ **The frame is the window, and the scrollbar is inside it.** Without an explicit height the
          inset only has a *minimum* one, so a tall page grows the document and every screen that wants
          to fill the viewport — the form workbench, a board — silently scrolls the whole application
          instead of its own panes, taking the sidebar and the page header off the top with it.

          ⚠️ **Counter-scaled against `--body-zoom`, and a plain `h-svh` here is a bug.** The font scale
          is applied as `body.style.zoom` (ThemeProvider), so a box declared `100svh` is laid out at the
          viewport's height in CSS pixels and then *rendered* that many times larger — at 1.125× the
          frame stands 12.5% taller than the window, and `overflow-hidden` cuts the bottom of it off
          with no scrollbar anywhere. What that hides is whatever a full-height screen pins to its
          bottom: the assistant's composer was simply not on the screen, on a page that otherwise looked
          perfectly fine. `--body-zoom` is the library's own counter-scale for exactly this, and the
          sidebar container next door carries a comment about the same trap. */}
      <SidebarInset className="h-[calc(100svh/var(--body-zoom,1))] overflow-hidden">
        {/* ⚠️ Above everything, and above the sidebar trigger: the one failure impersonation can
            produce is somebody forgetting whose data is on the screen. It renders nothing when nobody
            is inside a session, so it costs no height the rest of the time. */}
        <ImpersonationBanner />
        <div className="flex h-10 shrink-0 items-center border-b px-4 md:hidden">
          <SidebarTrigger className="-ml-1" />
        </div>
        {/* The one scroller. A page that wants to fill the frame asks for `h-full` and scrolls its own
            panes; everything else is ordinary content and this scrolls it.
            ⚠️ `overflow-x-hidden`, because a screen with a rail cancels this box's padding with `-mx-4`
            so its divider can reach the true edges: that leaves it 1rem wider than this content box on
            each side BY DESIGN, and `auto` on both axes would read those 2rem as something to scroll. */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto p-4">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
