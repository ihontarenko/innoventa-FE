import { NavLink, useLocation } from "react-router-dom"
import { Bookmark, Pin, TriangleAlert } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  Skeleton,
} from "@jmouse/ui"
import { InnoventaMark } from "@/components/icons/InnoventaMark"
import { AccountMenu } from "@/components/layout/AccountMenu"
import { QuickScan } from "@/components/custody/QuickScan"
import { useAllSavedViews } from "@/hooks/useSavedViews"
import { SpaceSwitcher } from "@/components/layout/SpaceSwitcher"
import { platformSections } from "@/navigation"
import { spaceSectionPath } from "@/lib/navigationContext"
import { spaceMenuIcon } from "@/lib/spaceMenuIcons"
import { useSpaceNavigation } from "@/hooks/useSpaces"
import { useAuthStore } from "@/stores/authStore"
import { useSpaceStore } from "@/stores/spaceStore"
import {
  hiddenItemKeysIn,
  PLATFORM_SCOPE,
  spaceScope,
  useNavigationPreferencesStore,
} from "@/stores/navigationPreferencesStore"

function isItemActive(pathname: string, itemPath: string) {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`)
}

/**
 * The one entry the current location counts as being on.
 *
 * ⚠️ **One winner, not a predicate per row.** `/admin/access` is described by both **Users** (`/admin`)
 * and **Access control**, and two highlighted rows read as a broken menu rather than as a nested place.
 * Longest path wins, so a future `/admin/settings/x` can never be outranked by `/admin`.
 */
function activePath(paths: string[], pathname: string): string | null {
  return (
    paths
      .filter((path) => isItemActive(pathname, path))
      .sort((first, second) => second.length - first.length)
      .at(0) ?? null
  )
}

/**
 * The menu the workspace itself serves.
 *
 * ⚠️ **Nothing here is filtered in the browser.** What a workspace shows follows from which modules it
 * has on and what its endpoints will answer, and the backend has already decided both — an item arrives
 * annotated with its standing and, where it is refused, with the refusing axis's own words. Re-deciding
 * any of that here would be the shell arguing with the server about what exists.
 */
function WorkspaceMenu({ spaceId, spaceSlug, pathname }: { spaceId: string; spaceSlug: string; pathname: string }) {
  const { data, isLoading, isError } = useSpaceNavigation(spaceId)

  // ⚠️ Personal, and only ever subtractive. What the workspace decides has already been applied by the
  // server; this hides what one reader asked not to see and changes nothing for anybody else.
  const preferences = useNavigationPreferencesStore((state) => state.preferences)
  const hidden = hiddenItemKeysIn(preferences, spaceScope(spaceId))

  if (isLoading) {
    return (
      <SidebarGroup>
        <SidebarGroupContent className="flex flex-col gap-1.5 px-2">
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-4/5" />
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  // ⚠️ Said in the column rather than thrown at a boundary, and never left as a spinner: there is no
  // local copy of a workspace's menu to fall back to, so "it did not load" is the honest answer and the
  // reader needs it exactly where the menu should have been.
  if (isError || !data) {
    return (
      <SidebarGroup>
        <SidebarGroupContent className="flex items-start gap-2 px-2 py-1.5 text-xs text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>This workspace's menu did not load. Everything else still works.</span>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  const sections = data.sections
    .map((section) => ({ ...section, items: section.items.filter((item) => !hidden.includes(item.key)) }))
    .filter((section) => section.items.length > 0)

  const allPaths = sections.flatMap((section) => section.items.map((item) => spaceSectionPath(spaceSlug, item.path)))
  const active = activePath(allPaths, pathname)

  return (
    <>
      {sections.map((section) => (
        <SidebarGroup key={section.key}>
          {section.label && <SidebarGroupLabel>{section.label}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {section.items.map((item) => {
                const href = spaceSectionPath(spaceSlug, item.path)
                const Icon = spaceMenuIcon(item.key)
                const refused = item.standing !== "PERMITTED"

                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      asChild={!refused}
                      // The refusing axis's own words — a plan limit and a missing permission are
                      // different answers and must not collapse into one greyed-out row.
                      tooltip={item.words ?? item.label}
                      isActive={active === href}
                      className={refused ? "cursor-not-allowed opacity-50" : undefined}
                    >
                      {refused ? (
                        <span>
                          <Icon />
                          <span className="truncate">{item.label}</span>
                          <PlanMark standing={item.standing} />
                        </span>
                      ) : (
                        <NavLink to={href}>
                          <Icon />
                          <span className="truncate">{item.label}</span>
                          <PlanMark standing={item.standing} />
                        </NavLink>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}

/**
 * The questions this person pinned.
 *
 * ⚠️ **Below the served menu and never inside it.** The sections above are the workspace's answer to
 * what it holds; these are one person's answer to what they keep asking. Mixing them would make a
 * personal bookmark look like part of the product, and the next reader would wonder why their sidebar
 * differs from the manual.
 *
 * ⚠️ **A pinned view links to its board and carries the view in the address**, so the link is
 * shareable, survives a reload and puts the Back button where somebody expects it. The board reads it
 * on mount; nothing is stored in the shell.
 */
function PinnedViews({ spaceSlug }: { spaceSlug: string }) {
  const location = useLocation()
  const { data: views = [] } = useAllSavedViews()
  const pinned = views.filter((view) => view.pinned)

  if (pinned.length === 0) {
    return null
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Views</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {pinned.map((view) => {
            const href = `${spaceSectionPath(spaceSlug, view.section)}?view=${view.id}`

            return (
              <SidebarMenuItem key={view.id}>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname + location.search === href}
                  tooltip={view.name}
                >
                  <NavLink to={href}>
                    <Pin />
                    <span className="truncate">{view.name}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

/** The menu outside every workspace: the account's own screens and system administration. */
function PlatformMenu({ pathname }: { pathname: string }) {
  // ⚠️ A courtesy, not the authorization — every route below is gated server-side and refuses on its
  // own. What it buys is that somebody who may not administer is not offered a screen full of controls
  // that will all say no. A group whose every entry is hidden goes with them: an empty heading reads as
  // something broken rather than as something absent.
  //
  // ⚠️ And it is the store's reading of the entry's own declaration, never a second one written here.
  // This was three lines repeating what `AccessRequirement` already says, in three files, and the copy
  // that mattered was the one a screen had made of it — see `authStore.holds`.
  const isVisible = useAuthStore((state) => state.holds)

  const preferences = useNavigationPreferencesStore((state) => state.preferences)
  const hidden = hiddenItemKeysIn(preferences, PLATFORM_SCOPE)

  // ⚠️ Two filters, and the order is not arbitrary. A permission decides whether an item *exists* for
  // this account; a preference decides whether one that exists is *drawn*. Hiding first would let
  // somebody personalise away a row they were never offered, and the preference would then follow them
  // to the day they were granted it.
  const sections = platformSections
    .map((section) => ({
      ...section,
      items: section.items.filter(isVisible).filter((item) => !hidden.includes(item.key)),
    }))
    .filter((section) => section.items.length > 0)

  const active = activePath(
    sections.flatMap((section) => section.items.map((item) => item.path)),
    pathname,
  )

  return (
    <>
      {sections.map((section) => (
        <SidebarGroup key={section.key}>
          <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {section.items.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton asChild tooltip={item.label} isActive={active === item.path}>
                    <NavLink to={item.path}>
                      <item.icon />
                      <span className="truncate">{item.label}</span>
                      {/* ⚠️ **Inside the row, not `SidebarMenuBadge` beside it.** That component is
                          `absolute` and takes its `top` from `peer-data-[size=…]/menu-button`, which
                          never matches here: the button is `asChild`, so the `data-size` those rules
                          read is not on the element the badge is a peer of. With no `top` at all every
                          badge fell to its static position — halfway between two rows, labelling the
                          wrong item. A built screen wearing "soon" is a lie the sidebar tells at a
                          glance, so this flows in the row instead of floating over it. */}
                      {!item.isBuilt && (
                        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">soon</span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}

export function ApplicationSidebar() {
  const location = useLocation()
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId)
  const activeSpaceSlug = useSpaceStore((state) => state.activeSpaceSlug)

  return (
    // No icon-only rail: Innoventa's sidebar is always fully expanded on desktop and becomes an
    // off-canvas drawer on mobile, which is this component's default.
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* The brand lockup: a 36px plate with a 24px mark, and the name in Onest at 24px/700 —
                the four values Innoventa's own `--brand-*` tokens hold. `font-bold` is stated rather
                than inherited, because SidebarMenuButton carries font-medium and a logotype is the one
                place two products cannot afford to look like two brands. */}
            <SidebarMenuButton size="lg" className="h-auto gap-2.5 px-1.5 py-1" asChild>
              <NavLink to="/hub">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
                  <InnoventaMark className="size-6" />
                </span>
                <span className="min-w-0 flex-1 font-brand text-[24px] leading-none font-bold tracking-[-0.02em]">
                  Innoventa
                </span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SpaceSwitcher />
      </SidebarHeader>

      <SidebarContent>
        {activeSpaceId && activeSpaceSlug ? (
          <>
            {/* ⚠️ Above the menu and not in it: a scan is not a destination, it is how somebody selects
                a thing without knowing which screen it is on. It draws nothing where the workspace
                does not hand its things to people — and it carries its own group, so *nothing* is what
                it draws. Wrapped from here, its `null` emptied the chrome instead of removing it, and
                every workspace without custody opened with a hole above its first heading. */}
            <QuickScan />

            {/* ⚠️ Above the served menu, not below it. These are the questions somebody asks daily; at
                the bottom of a menu with three groups above it they are past the fold, which is the one
                place a shortcut is worth nothing. */}
            <PinnedViews spaceSlug={activeSpaceSlug} />

            <WorkspaceMenu spaceId={activeSpaceId} spaceSlug={activeSpaceSlug} pathname={location.pathname} />

            {/* ⚠️ Client-side like `PinnedViews`, and NOT a served section. The workspace menu is what
                this workspace decided to present — its modules and its screens — and this is neither: it
                is where the questions asked *of* those screens are kept. A served entry would also mean
                a backend change before a shared library's screen could be reached, which is the wrong
                dependency for something every workspace has by construction. */}
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname.endsWith("/saved-views")}
                      tooltip="Saved views"
                    >
                      <NavLink to={spaceSectionPath(activeSpaceSlug, "saved-views")}>
                        <Bookmark />
                        <span className="truncate">Saved views</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : (
          <PlatformMenu pathname={location.pathname} />
        )}
      </SidebarContent>

      <SidebarFooter>
        <AccountMenu />
      </SidebarFooter>
    </Sidebar>
  )
}

/**
 * "plan" beside an item the workspace's tier does not include.
 *
 * ⚠️ **In the row rather than `SidebarMenuBadge` over it**, for the reason spelled out on the "soon"
 * mark above: that component's `top` comes from a `peer-data-[size=…]` rule that never matches an
 * `asChild` button, so it lands halfway between two rows and marks the wrong one.
 */
function PlanMark({ standing }: { standing?: string }) {
  if (standing !== "NOT_IN_PLAN") {
    return null
  }

  return <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">plan</span>
}
