import { AccountAvatar } from "@/components/AccountAvatar"
import { NavLink } from "react-router-dom"
import { ChevronsUpDown, LogOut, Palette, UserRound } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  Skeleton,
} from "@jmouse/ui"
import { useAuthStore } from "@/stores/authStore"
import { useSignOut } from "@/hooks/useProfile"

/**
 * The one thing in the sidebar's footer: who you are, and everything that is about you rather than
 * about the work.
 *
 * ⚠️ **Access control is not here, and its absence is the point.** It was offered from this menu, to
 * holders of `access:read` — a second door onto `/admin/access`, which the Administration screen
 * already carries under the same permission and the same label. A duplicate entry is not a
 * shortcut: it asks the reader to work out whether the two lead to the same screen. Tessera and Kiwi
 * moved their own out of this menu on the same day, for the harder version of the same reason — over
 * there it was the ONLY way in, and the account menu is what is about *you*, not about everybody.
 */
export function AccountMenu() {
  const user = useAuthStore((state) => state.user)
  const signOut = useSignOut()

  if (!user) {
    return (
      <div className="px-2 py-1.5">
        <Skeleton className="h-9 w-full" />
      </div>
    )
  }

  const name = user.displayName ?? user.email

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {/* ⚠️ **`DropdownMenuTrigger`, and it was missing here too.** A button that is only a *child*
            of `DropdownMenu` is a button — Radix attaches nothing to it, and the click does nothing
            with no error anywhere. Both sidebar menus had it, which is what made it look like a
            styling problem rather than one line. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="h-auto py-1.5">
              {/* One component knows an avatar has kinds — see AccountAvatar. A screen that reached
                  past it to build a URL would be a screen that breaks silently the next time the
                  address moves, which is exactly what INVT-0064 did to the old one. */}
              <AccountAvatar account={user} className="size-8 rounded-lg" />
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">{name}</span>
                {user.displayName && <span className="truncate text-xs text-muted-foreground">{user.email}</span>}
              </span>
              <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-60" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-(--sidebar-width) max-w-[16rem]">
            <DropdownMenuItem asChild>
              <NavLink to="/settings">
                <UserRound className="size-4" />
                Account
              </NavLink>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <NavLink to="/settings/appearance">
                <Palette className="size-4" />
                Appearance
              </NavLink>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onSelect={() => signOut.mutate()}>
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
