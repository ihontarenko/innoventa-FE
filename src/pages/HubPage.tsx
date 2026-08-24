import { useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Button, Skeleton } from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useDiscoverableSpaces, useJoinSpace, useReachableContext } from "@/hooks/useSpaces"
import type { ReachableSpace } from "@/api/spaces"
import { CreateSpaceDialog } from "@/components/space/CreateSpaceDialog"
import { SpaceList } from "@/components/space/SpaceList"

/**
 * Everywhere you can work, and the two things you can do from outside a workspace.
 *
 * ⚠️ **There is no "Continue" block, and that is the design rather than an omission.** The old screen
 * had one above the grid, repeating cards that appeared again below under their organisation — the same
 * workspace stated twice on the one screen built to stop saying things twice, and stated identically
 * both times, since a card carries no trace of having been the recent one. What it actually held was an
 * **ordering**, which belongs to the list rather than beside it. See `useReachableContext`.
 *
 * ⚠️ **One workspace is not a list.** A list of one row is an obstacle rather than a choice, so the
 * page says where to go and stops.
 *
 * ⚠️ **No workspaces is a question, not an empty grid.** "What do you count?" — plus whatever is open to
 * join, because "join one that already exists" is the other honest answer to having none.
 */
export function HubPage() {
  const { data: context, isLoading } = useReachableContext()
  const [isCreating, setCreating] = useState(false)

  const spaces = context?.spaces ?? []
  const organizations = context?.organizationsVisible ? context.organizations : []

  if (isLoading) {
    return (
      <>
        <PageHeader title="Hub" />
        <div className="flex w-full flex-col gap-1.5 lg:max-w-[80%]">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      </>
    )
  }

  if (spaces.length === 0) {
    return <NothingYet />
  }

  const single = spaces.length === 1 ? spaces[0] : null

  return (
    <>
      <PageHeader
        title="Hub"
        description="Where you can go, and what is waiting there"
        actions={<Button size="sm" onClick={() => setCreating(true)}>New workspace</Button>}
      />

      {isCreating && <CreateSpaceDialog onClose={() => setCreating(false)} />}

      {single ? (
        <SingleWorkspace space={single} />
      ) : organizations.length > 0 ? (
        <div className="flex flex-col gap-8">
          {organizations.map((organization) => (
            <section key={organization.id} className="flex flex-col gap-3">
              <h2 className="text-xs tracking-[0.07em] text-muted-foreground uppercase">{organization.name}</h2>
              <SpaceList spaces={spaces.filter((space) => space.organizationId === organization.id)} />
            </section>
          ))}
        </div>
      ) : (
        <SpaceList spaces={spaces} />
      )}
    </>
  )
}

/** One workspace: the page is a door, not a chooser. */
function SingleWorkspace({ space }: { space: ReachableSpace }) {
  return (
    <div className="flex max-w-lg flex-col items-start gap-3 rounded-lg border p-6">
      <span aria-hidden="true" className="text-2xl">
        {space.subjectAreaIcon ?? "▫"}
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">{space.name}</h2>
        <p className="text-sm text-muted-foreground">{space.subjectAreaLabel}</p>
      </div>
      {space.description && <p className="text-sm text-muted-foreground">{space.description}</p>}
      <Button asChild>
        <Link to={spaceSectionPath(space.slug)}>Open</Link>
      </Button>
    </div>
  )
}

/**
 * ⚠️ **A question rather than an empty grid with a button beside it.** Somebody with no workspace has
 * not failed to make one — they have not yet said what they count, which is the first thing this
 * product asks and the thing every menu follows from.
 */
function NothingYet() {
  const [isCreating, setCreating] = useState(false)
  const { data: open = [] } = useDiscoverableSpaces(true)
  const joinSpace = useJoinSpace()

  return (
    <>
      <PageHeader title="Welcome to Innoventa" />

      <div className="flex max-w-xl flex-col items-start gap-4 rounded-lg border border-dashed p-8">
        <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">What do you count?</h2>
        <p className="text-sm text-muted-foreground">
          Components, tools, samples, equipment — a workspace takes the shape of whichever it is, and
          everything it shows you follows from that one answer.
        </p>
        <Button onClick={() => setCreating(true)}>Make a workspace</Button>
        {isCreating && <CreateSpaceDialog onClose={() => setCreating(false)} />}
      </div>

      {open.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs tracking-[0.07em] text-muted-foreground uppercase">Open to join</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {open.map((space) => (
              <div key={space.id} className="flex flex-col gap-2 rounded-lg border p-4">
                <span className="font-medium">{space.name}</span>
                {space.description && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{space.description}</p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-auto self-start"
                  disabled={joinSpace.isPending}
                  onClick={() =>
                    joinSpace.mutate(space.id, {
                      onSuccess: () => toast.success(`Joined ${space.name}.`),
                      onError: () => toast.error("That workspace did not let you in."),
                    })
                  }
                >
                  Join
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
