import { Link } from "react-router-dom"
import { Button, cn } from "@jmouse/ui"
import { spaceSectionPath } from "@/lib/navigationContext"
import type { ReachableSpace } from "@/api/spaces"

/**
 * Everywhere you can go, as one list.
 *
 * ⚠️ **Rows rather than cards, and the difference is what the screen is for.** A card per workspace
 * spends a hundred pixels of height to say a name and one line about it, and on a wide monitor most of
 * that width goes to the gap between the name and the button while the description is clamped at two
 * lines. A row says the same things in forty pixels and gives the width back to the *description* —
 * the thing that was being truncated. The paint is the legacy interface's, ported onto this one's
 * tokens rather than its stylesheet.
 *
 * ⚠️ **The whole row is the link, and the Open is a span.** A control inside a link is a control the
 * keyboard cannot reach the way it looks like it should, and there is only one thing to do with a
 * workspace anyway. This is also why the hub keeps its own row rather than drawing the catalogue
 * screens' `EntityCard`: those rows carry verbs and a delete, so their name is the only target they
 * can offer. Same paint, two different jobs — see `compact-card.tsx` in `@jmouse/ui`.
 *
 * ⚠️ **The list is its own query container.** The row folds into a stack on the width the *list* has,
 * which on the hub — with a sidebar beside it — is never the window's.
 */
export function SpaceList({ spaces, className }: { spaces: ReachableSpace[]; className?: string }) {
  return (
    <div
      className={cn(
        // Narrower than the page: a one-line row three metres wide leaves the eye no way back to the
        // start of the next one, and the descriptions are nowhere near long enough to need it.
        "@container w-full overflow-hidden rounded-lg border bg-card lg:max-w-[80%]",
        className,
      )}
    >
      {spaces.map((space) => (
        <SpaceRow key={space.id} space={space} />
      ))}
    </div>
  )
}

function SpaceRow({ space }: { space: ReachableSpace }) {
  return (
    <Link
      to={spaceSectionPath(space.slug)}
      className={cn(
        "group flex items-center gap-2.5 border-l-[3px] border-l-transparent px-3 py-1.5 transition-colors",
        "border-t first:border-t-0 hover:border-l-primary hover:bg-accent/50",
        "@max-[480px]:flex-wrap @max-[480px]:py-2",
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-[13px] leading-none"
      >
        {space.subjectAreaIcon ?? space.name[0]?.toUpperCase() ?? "·"}
      </span>

      <span className="shrink-0 truncate font-display text-[13px] font-bold tracking-[-0.01em] @max-[480px]:flex-1">
        {space.name}
      </span>

      {/* The description takes the row's spare width; without it the meta and the Open would sit
          against the name. Below the fold it becomes a second line under the glyph, because an
          ellipsis after three words is worse than no description at all. */}
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground @max-[480px]:order-3 @max-[480px]:basis-full @max-[480px]:pl-[34px]">
        {space.description && (
          <>
            <span className="text-muted-foreground/70 @max-[480px]:hidden">· </span>
            {space.description}
          </>
        )}
      </span>

      {/* ⚠️ What a workspace *counts* decides what its menu even contains, so the subject area stays on
          the row — quiet, and first to go when the row runs out of width. The role the card carried is
          not here: on a list it reads "owner" down every row of the installation somebody owns, which
          is a column of the same word competing with the description for the width. */}
      <span className="shrink-0 text-[11px] whitespace-nowrap text-muted-foreground @max-[700px]:hidden">
        {[
          space.subjectAreaLabel,
          `${space.memberCount} ${space.memberCount === 1 ? "member" : "members"}`,
          // Said only where it is true. "never opened" on every row of a fresh installation is noise;
          // on one row among six it is the useful half of the sort.
          !space.lastVisitedAt ? "not opened yet" : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>

      {/* ⚠️ **The library's button, drawn onto a span.** A `<button>` inside an `<a>` is invalid HTML —
          the browser reparents it and both stop working — but a hand-rolled pill beside the same verb
          on another screen is two buttons that are nearly the same, which is worse. `asChild` gives the
          span every class the real control has, and the row it sits in stays the only target. */}
      <Button asChild variant="outline" size="sm">
        <span>Open</span>
      </Button>
    </Link>
  )
}
