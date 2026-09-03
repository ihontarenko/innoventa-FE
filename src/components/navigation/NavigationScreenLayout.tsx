import { useState } from "react"
import { NavLink, Outlet, useLocation } from "react-router-dom"
import { cn } from "@jmouse/ui"
import { PageHeaderSlotProvider } from "@/components/layout/PageHeaderSlot"
import { activePath } from "@/lib/menuActivation"
import { useAuthStore } from "@/stores/authStore"
import { navigationScreen, screenItems } from "@/navigation"

/**
 * A screen that is itself a menu — Administration: its rail, and whichever of its destinations is open.
 *
 * ⚠️ **The navigation is on the SCREEN, and the sidebar never changes.** An earlier attempt swapped the
 * platform menu out while the reader was inside Administration, the way entering a workspace does. It
 * worked and it was the wrong shape: a separate administration page is a page you go *to*, not a mode
 * the whole application enters. The left menu now reads identically on `/hub` and on `/admin/access`.
 *
 * ⚠️ **The rail is a list of LINKS, and it imposes no address prefix.** `Purposes` is on it and lives
 * at `/purposes`, because purposes are installation-wide and that address is deliberately kept out of
 * `LEGACY_SPACE_SECTIONS`. Being grouped under a screen is not the same as living under its route.
 *
 * ⚠️ **The header slot is the first child and the rail is not.** `PageHeader` cancels the content box's
 * padding with negative margins; inside the rail's grid cell it would cancel the wrong box. So the open
 * screen's own header — its title, its subtitle, its *New user* button — portals up here, full width,
 * above the rail. `PageHeaderSlot` carries the whole reasoning; the point of it is that not one of the
 * ten administrative screens had to be edited to keep what it already had.
 */
export function NavigationScreenLayout({ screenKey }: { screenKey: string }) {
  const screen = navigationScreen(screenKey)
  const location = useLocation()

  // ⚠️ A courtesy, not the authorization — every destination is gated server-side and refuses on its
  // own. And it is the store's reading of each entry's own declaration, the same reader the landing and
  // the personalisation tab use.
  const isVisible = useAuthStore((state) => state.holds)

  /**
   * ⚠️ **A callback ref into state, not a `useRef`.** A ref's `.current` changes without telling
   * anybody, so the portal would be asked for its target on the render *before* the node exists and
   * never asked again. State re-renders in the same commit, so the header is in the right place before
   * the browser paints — there is no frame in which it appears in the wrong column.
   */
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null)

  // A group with nothing left in it is dropped rather than drawn as a heading over nothing.
  const groups = screen.groups
    .map((group) => ({ ...group, items: group.items.filter(isVisible) }))
    .filter((group) => group.items.length > 0)

  const active = activePath([screen.path, ...screenItems(screen).map((item) => item.path)], location.pathname)

  return (
    <PageHeaderSlotProvider node={headerSlot}>
      {/* `contents` so the wrapper adds no box of its own: the portalled header becomes a direct flex
          child of the content box, exactly where a header rendered in place would have been. */}
      <div ref={setHeaderSlot} className="contents" />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
        {/* The negative block margins and the divider are Innoventa's own rail, the one Account
            settings already draws — so two railed screens are two screens rather than two designs. */}
        <nav
          aria-label={screen.label}
          className="flex min-h-0 flex-col gap-4 overflow-y-auto lg:-mt-4 lg:-mb-4 lg:border-r lg:py-4 lg:pr-2"
        >
          {/* The way back to the map: the landing carries a line under every destination saying what it
              is for, which a rail of nine short labels cannot. */}
          <RailLink to={screen.path} isActive={active === screen.path} icon={screen.icon} label={`All of ${screen.label}`} />

          {groups.map((group) => (
            <div key={group.key} className="flex flex-col gap-1">
              {group.label && (
                // px-2 so the heading sits on the same left edge as the links under it.
                <h2 className="px-2 text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
                  {group.label}
                </h2>
              )}

              {group.items.map((item) => (
                <RailLink
                  key={item.key}
                  to={item.path}
                  isActive={active === item.path}
                  icon={item.icon}
                  label={item.label}
                  title={item.description}
                />
              ))}
            </div>
          ))}
        </nav>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </PageHeaderSlotProvider>
  )
}

function RailLink({
  to,
  isActive,
  icon: Icon,
  label,
  title,
}: {
  to: string
  isActive: boolean
  icon: React.ComponentType<{ className?: string }>
  label: string
  title?: string
}) {
  return (
    <NavLink
      to={to}
      title={title}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
        isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-accent/50",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  )
}
