import { useNavigate, useParams } from "react-router-dom"
import { Skeleton, cn } from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { useSpace, useSpaceModules } from "@/hooks/useSpaceSettings"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useSpaceStore } from "@/stores/spaceStore"
import { SPACE_SETTINGS_SECTIONS } from "./settings/sections"
import type { SpaceSettingsContext } from "./settings/SpaceSettingsSection"

/**
 * Configuring a workspace, from inside that workspace.
 *
 * It used to be a panel on the platform's list of workspaces, which meant leaving a workspace in order
 * to change it and gave one screen three jobs — listing them, creating them, and configuring whichever
 * one happened to be expanded. What a workspace counts, which modules are on, who is in it and which
 * forms it shows all belong to the workspace they are about.
 *
 * ⚠️ **The page holds no list of sections.** It renders the registry, filtered through the workspace's
 * own module surface — the same surface the sidebar reads — so a section can never appear for a module
 * the workspace does not have, and adding one is a file rather than an edit here.
 */
export function SpaceSettingsPage() {
  const navigate = useNavigate()
  const { tab } = useParams<{ tab?: string }>()

  // ⚠️ The active workspace, not one named in this component: `NavigationContextGate` above the layout
  // has already resolved the address into a workspace, and every request below it carries the same one
  // in `X-Space-Id`.
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  const { data: space, isLoading } = useSpace(spaceId ?? undefined)
  const { data: modules = [] } = useSpaceModules(spaceId ?? undefined)

  if (isLoading || !space) {
    return <Skeleton className="h-64 w-full" />
  }

  const isOwner = space.currentUserRole === "OWNER"
  const settingsContext: SpaceSettingsContext = {
    space,
    isOwner,
    isAdmin: isOwner || space.currentUserRole === "ADMIN",
  }

  const enabledModuleKeys = new Set(modules.filter((module) => module.enabled).map((module) => module.key))
  const sections = SPACE_SETTINGS_SECTIONS.filter(
    (section) => !section.module || enabledModuleKeys.has(section.module),
  ).filter((section) => section.visible?.(settingsContext) ?? true)

  // An address naming a section this workspace does not have falls back to the first one rather than
  // rendering nothing — a workspace with `forms` off should not answer a stale bookmark with an empty
  // panel.
  const active = sections.find((section) => section.key === tab) ?? sections[0]

  return (
    <>
      <PageHeader title="Workspace settings" description={space.name} />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav className="flex min-h-0 flex-col gap-0.5 overflow-y-auto lg:-mt-4 lg:-mb-4 lg:border-r lg:py-4 lg:pr-2">
          {sections.map((section) => (
            <button
              key={section.key}
              type="button"
              onClick={() => navigate(spaceSectionPath(space.slug, `settings/${section.key}`))}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                active.key === section.key ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-accent/50",
              )}
            >
              <span aria-hidden="true" className="w-4 shrink-0 text-center">
                {section.glyph}
              </span>
              {section.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          <active.Component {...settingsContext} />
        </div>
      </div>
    </>
  )
}
