import { Navigate, useLocation, useParams } from "react-router-dom"
import { Badge, Card, CardContent, Skeleton } from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { spaceSectionOf, spaceSectionPath } from "@/lib/navigationContext"
import { useSpaceNavigation } from "@/hooks/useSpaces"
import { useSpaceStore } from "@/stores/spaceStore"
import { SCREENS, TICKET_BY_SECTION } from "@/pages/workspace/sections"

/**
 * Any section of a workspace — the built one, or a note about the ticket that will build it.
 *
 * ⚠️ **One route rather than a list of them**, and that is not laziness: a workspace's sections are
 * contributed by its subject area and arrive from the server, so the browser cannot know their names.
 * Writing them out here would be a second, drifting copy of the served menu — and the first workspace
 * with a section this list had never heard of would show a menu entry leading to a 404.
 *
 * ⚠️ **The registry decides, not this file.** A section with a screen renders it; everything else falls
 * through to the placeholder. Adding a screen is one line in `sections.ts` rather than a route here.
 */
export function WorkspaceSectionPage() {
  const location = useLocation()
  const section = spaceSectionOf(location.pathname)

  // ⚠️ **A workspace root is not a screen, it is a destination.** `/space/{slug}` used to fall through
  // to the placeholder and cite whichever ticket the table defaulted to — which is where every Hub card
  // and every workspace switch lands, so the product's most-taken door opened onto "not ported yet".
  if (section === "") {
    return <WorkspaceRoot />
  }

  const Screen = SCREENS[section]

  if (Screen) {
    return <Screen />
  }

  return <NotPortedYet section={section} />
}

/**
 * Where a workspace opens, decided by the workspace.
 *
 * ⚠️ **The first item of the SERVED menu, never a name written here.** What a workspace opens on follows
 * from what it counts — an electronics workspace starts at its inventory, a generic one at its forms —
 * and hard-coding either would be a third place that has to agree with the subject area.
 */
function WorkspaceRoot() {
  const { spaceSlug } = useParams()
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId)
  const { data, isLoading } = useSpaceNavigation(activeSpaceId)

  const firstSection = data?.sections.flatMap((group) => group.items)[0]

  if (isLoading || !data) {
    return (
      <>
        <PageHeader title="Workspace" description={spaceSlug} />
        <Skeleton className="h-32 max-w-xl" />
      </>
    )
  }

  if (firstSection && spaceSlug) {
    // ⚠️ `replace`, so Back leaves the workspace rather than bouncing through the root again.
    return <Navigate to={spaceSectionPath(spaceSlug, firstSection.path)} replace />
  }

  // ⚠️ A workspace whose subject area presents nothing at all. Rare, and a real state rather than an
  // error: every module can be switched off, and the honest answer is to say so.
  return (
    <>
      <PageHeader title="Workspace" description={spaceSlug} />
      <Card className="max-w-xl">
        <CardContent className="flex flex-col gap-2 pt-6">
          <p className="text-sm">This workspace presents no sections.</p>
          <p className="text-sm text-muted-foreground">
            What a workspace shows follows from what it counts, and every module here is switched off.
            Its settings are the way back in.
          </p>
        </CardContent>
      </Card>
    </>
  )
}

function NotPortedYet({ section }: { section: string }) {
  const { spaceSlug } = useParams()
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId)
  const { data } = useSpaceNavigation(activeSpaceId)

  const item = data?.sections.flatMap((group) => group.items).find((candidate) => candidate.path === section)
  const title = item?.label ?? section

  return (
    <>
      <PageHeader title={title} description={spaceSlug} />
      <Card className="max-w-xl">
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex items-center gap-2">
            {/* ⚠️ Named, never defaulted. A placeholder that cites whichever ticket the table happens to
                fall back to sends somebody to a closed one — which is exactly how Labels sat behind a
                Done ticket for weeks. An unlisted section says it is unlisted. */}
            {TICKET_BY_SECTION[section] ? (
              <>
                <Badge variant="secondary">{TICKET_BY_SECTION[section]}</Badge>
                <span className="text-sm text-muted-foreground">brings this screen over</span>
              </>
            ) : (
              <Badge variant="destructive">no ticket names this section</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            The workspace context is here — the address names the workspace, the menu comes from the server, and every
            request below carries the right <code className="font-mono text-xs">X-Space-Id</code>. What is missing is
            the screen itself.
          </p>
        </CardContent>
      </Card>
    </>
  )
}
