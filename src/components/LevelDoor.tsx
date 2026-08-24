import { Link } from "react-router-dom"
import { ChevronDown } from "lucide-react"
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@jmouse/ui"

/**
 * A way between two levels of the same thing, and deliberately not a peer of the screen's own actions.
 *
 * ⚠️ **The levels must not cross** (Ivan, 2026-08-19). One row in `forms` is two different objects
 * depending on who is looking:
 *
 * | Level | Screen | What it is there | What it is asked |
 * |---|---|---|---|
 * | low | *Form library* | a **schema** — fields, a purpose, an audience, a share link | how is this form built |
 * | high | *Component types*, *Inventory*, *Parts catalog* | a **component type** — an electronics thing this workspace stocks | what do we have, and how much |
 *
 * A high-level screen that grew a "required?" toggle, or a library that grew a stock count, would be one
 * screen answering both questions badly — and the moment a second subject area arrives (equipment,
 * something else entirely) the mixed screen has to be split anyway, by somebody who no longer remembers
 * which control belonged to which level.
 *
 * ⚠️ **So the levels stay apart and a door joins them.** This is the door: quieter than the verbs it
 * stands beside, and named after where it leads. Going *down* is "show me how this is built"; going
 * *up* is "show me this as the domain sees it" — and the label is what says which.
 *
 * ⚠️ **Drawn as a button, because it is one** (Ivan, 2026-08-21). As bare grey text beside a ghost
 * "Add one" it read as a caption rather than a control — nothing on the row said either could be
 * pressed. It is the same `outline` button every other verb on the row is, so the product has one
 * button rather than a family of near-misses.
 *
 * ⚠️ **And no chevron in front of the label.** A caret at the left edge of a bordered control is what a
 * `<select>` looks like, so the door read as a closed dropdown — a mark for the direction of travel is
 * not worth a control people expect to expand. The label carries the direction instead — "Manage", "Open
 * the form library" — which is why there is no `direction` property either: a value nothing reads is a
 * value every call site has to keep true for nothing.
 */
export function LevelDoor({
  label,
  to,
  onOpen,
  className,
}: {
  label: string
  /** Where it leads. Give one of `to` or `onOpen` — a door with neither is a label. */
  to?: string
  onOpen?: () => void
  className?: string
}) {
  if (to) {
    return (
      <Button asChild variant="outline" size="sm" className={className}>
        <Link to={to}>{label}</Link>
      </Button>
    )
  }

  return (
    <Button variant="outline" size="sm" className={className} onClick={onOpen}>
      {label}
    </Button>
  )
}

/**
 * Several doors out of one thing, offered as one control.
 *
 * ⚠️ **Because one purpose has more than one face.** A form describing stock is a *component type* on one
 * screen and the *stock counted against it* on another; a form describing a thing is on the assets board
 * and is also the class a watch is configured against. Rendering one door would mean whoever wrote the
 * subject area had to pick a favourite, and the card would be right about half the time.
 *
 * ⚠️ **One door stays a plain button.** A dropdown that opens onto a single item is a click somebody
 * pays for nothing, and it makes the ordinary case look like a menu it is not.
 *
 * ⚠️ **The labels are the server's**, in the workspace's own words — this component knows no section
 * names, no routes and no nouns, which is the whole reason the map moved out of the screens.
 */
export function LevelDoors({
  doors,
  className,
}: {
  doors: Array<{ label: string; to: string }>
  className?: string
}) {
  if (doors.length === 0) {
    return null
  }

  if (doors.length === 1) {
    return <LevelDoor label={doors[0].label} to={doors[0].to} className={className} />
  }

  return (
    <DropdownMenu>
      {/* ⚠️ `DropdownMenuTrigger` with `asChild`, never a bare Button — a button that is only a *child*
          of the menu opens nothing, which is how two dropdowns in the sidebar came to be dead. */}
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          Seen elsewhere
          <ChevronDown className="ml-1 size-3" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>

      {/* The caret is on the TRIGGER here and nowhere else. A caret on a plain door would make it read
          as a closed `<select>`; on something that genuinely expands it is the truth. */}
      <DropdownMenuContent align="end">
        {doors.map((door) => (
          <DropdownMenuItem key={door.to} asChild>
            <Link to={door.to}>{door.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
