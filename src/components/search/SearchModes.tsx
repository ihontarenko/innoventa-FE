import { NavLink } from "react-router-dom"
import { cn } from "@jmouse/ui"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useSpaceStore } from "@/stores/spaceStore"

/**
 * The three ways of asking one question, as one strip.
 *
 * <h2>⚠️ Three menu entries became three modes, and the screens did not move</h2>
 *
 * <p>*Search*, *Parametric search* and *Lookup* were three items in the sidebar teaching three separate
 * words for *which part is it?* — by name, by parameter, or by what a distributor holds. A menu is a
 * list of places to go, and three entries for one question makes somebody choose between them before
 * they know which one answers.
 *
 * <p>⚠️ **Each tab is a LINK to the route that already existed**, not a mode flag on one component. The
 * three screens keep their own addresses, so every link anybody saved still resolves, and none of them
 * had to be rewritten to be reachable this way. What changed is where they are found.
 *
 * <p>⚠️ **`Synonyms` is not here.** It is not a way of asking — it is the table that makes two spellings
 * of one manufacturer the same manufacturer, which is configuration. It lives in the workspace's own
 * settings, and its route is untouched.
 */
const MODES = [
  { section: "search", label: "By name" },
  { section: "parametric-search", label: "By parameter" },
  { section: "lookup", label: "Supplier prices" },
] as const

export function SearchModes() {
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)

  if (!spaceSlug) {
    return null
  }

  return (
    <nav
      aria-label="How to search"
      // ⚠️ A rule under the row rather than a box around it: this is a strip of destinations at the top
      // of a screen, and a bordered card would read as a control panel belonging to the results below.
      className="border-border -mt-1 flex items-center gap-1 border-b"
    >
      {MODES.map((mode) => (
        <NavLink
          key={mode.section}
          to={spaceSectionPath(spaceSlug, mode.section)}
          end
          className={({ isActive }) =>
            cn(
              "-mb-px border-b-2 px-3 py-1.5 text-[13px] transition-colors duration-[120ms]",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              isActive
                ? "border-b-primary text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground border-b-transparent",
            )
          }
        >
          {mode.label}
        </NavLink>
      ))}
    </nav>
  )
}
