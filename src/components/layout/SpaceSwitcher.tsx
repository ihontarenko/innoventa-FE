import { useNavigate } from "react-router-dom"
import { useState } from "react"
import { Check, ChevronsUpDown, Home, Plus } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@jmouse/ui"
import { PLATFORM_HOME_PATH, spaceSectionPath } from "@/lib/navigationContext"
import { useSpaces } from "@/hooks/useSpaces"
import { useSpaceStore } from "@/stores/spaceStore"
import { CreateSpaceDialog } from "@/components/space/CreateSpaceDialog"

/**
 * Which workspace you are in, and the way into another.
 *
 * ⚠️ **Switching navigates rather than writing the store.** The address is the source of truth for the
 * active workspace; setting the store first would leave the two disagreeing for a frame, and the frame
 * is long enough for a request to go out with the wrong `X-Space-Id`. The gate writes the store when the
 * new address resolves — and only then.
 *
 * ⚠️ **It lands on the workspace root, not on the same section.** Sections are contributed by a subject
 * area, so the screen you are on may simply not exist in the workspace you are moving to; carrying the
 * path across is how somebody switches workspace and arrives at a 404.
 */
export function SpaceSwitcher() {
  const navigate = useNavigate()
  const { data: spaces = [] } = useSpaces()
  const activeSpaceSlug = useSpaceStore((state) => state.activeSpaceSlug)
  const [isCreating, setCreating] = useState(false)

  if (spaces.length === 0) {
    return null
  }

  const active = spaces.find((space) => space.slug === activeSpaceSlug) ?? null

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {/* ⚠️ **`DropdownMenuTrigger` is what makes this open, and it was missing.** A button that is
            merely a *child* of `DropdownMenu` is a button: Radix attaches nothing to it, so it carried
            no `aria-haspopup`, no `aria-expanded` and no `data-state`, and clicking it did nothing at
            all — silently, with no console error, because nothing was wrong except that nobody was
            listening. `/ui-kit` had the trigger and worked, which is exactly why the kit is worth
            having. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="h-auto py-1.5">
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">{active ? active.name : "All workspaces"}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {active ? "Workspace" : `${spaces.length} to choose from`}
                </span>
              </span>
              <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-60" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-(--sidebar-width) max-w-[16rem]">
            <DropdownMenuLabel className="text-[10px] tracking-[0.07em] text-muted-foreground uppercase">
              Workspaces
            </DropdownMenuLabel>

            {spaces.map((space) => (
              <DropdownMenuItem key={space.id} onSelect={() => navigate(spaceSectionPath(space.slug))}>
                <span className="truncate">{space.name}</span>
                {space.slug === activeSpaceSlug && <Check className="ml-auto size-4" />}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            <DropdownMenuItem onSelect={() => navigate(PLATFORM_HOME_PATH)}>
              <Home className="size-4" />
              Leave the workspace
            </DropdownMenuItem>

            {/* ⚠️ Here as well as on the hub: this menu is where somebody already IS when they realise
                the thing they are filing does not belong in this workspace. */}
            <DropdownMenuItem onSelect={() => setCreating(true)}>
              <Plus className="size-4" />
              New workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      {isCreating && <CreateSpaceDialog onClose={() => setCreating(false)} />}
    </SidebarMenu>
  )
}
