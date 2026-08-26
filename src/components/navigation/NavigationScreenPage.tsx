import { NavLink } from "react-router-dom"
import { RowGroup } from "@jmouse/ui"
import { AccessDenied } from "@/components/AccessDenied"
import { PageHeader } from "@/components/PageHeader"
import { useAuthStore } from "@/stores/authStore"
import { navigationScreen, requiredPermissionsOf, screenItems, type NavigationItem } from "@/navigation"

/**
 * The landing of a screen that is itself a menu — Administration, the Workbench.
 *
 * ⚠️ **One component for both, driven by the declaration.** Two files rendering the same grouped grid
 * would be the same design twice, and the second one to be edited is the one that starts looking
 * different. The screens differ in what they hold, which is data, not markup.
 *
 * ⚠️ **This is the map, and the rail beside it is the shortcut.** Both are drawn — the rail carries
 * nine short labels, and only a card has room for the line that says what a destination is *for*. So
 * `/admin` is somewhere to arrive rather than a redirect into whichever section happened to be first.
 *
 * The rail, the header slot and why the header of the open screen appears above both live in
 * `NavigationScreenLayout`.
 */
export function NavigationScreenPage({ screenKey }: { screenKey: string }) {
  const screen = navigationScreen(screenKey)

  // ⚠️ The store's reading of each entry's own declaration, never a second one written here — the same
  // reader the sidebar and the personalisation tab use. A copy would be a third opinion about which
  // destinations this account has.
  const mayOpen = useAuthStore((state) => state.holds)

  // A group with nothing left in it is dropped rather than drawn as a heading over nothing.
  const groups = screen.groups
    .map((group) => ({ ...group, items: group.items.filter(mayOpen) }))
    .filter((group) => group.items.length > 0)

  if (groups.length === 0) {
    return (
      <AccessDenied
        title={screen.label}
        why={`Nothing on ${screen.label} is open to this account. It is not empty — it is refused.`}
        permissions={[...new Set(screenItems(screen).flatMap(requiredPermissionsOf))]}
      />
    )
  }

  return (
    <>
      <PageHeader title={screen.label} description={screen.description} />

      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <RowGroup key={group.key} label={group.label} tally={group.label && tallyOf(group.items.length)}>
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {group.items.map((item) => (
                <DestinationCard key={item.key} item={item} />
              ))}
            </div>
          </RowGroup>
        ))}
      </div>
    </>
  )
}

/**
 * One destination.
 *
 * ⚠️ **An anchor, not a button with a handler.** These are addresses somebody opens in a second tab,
 * copies, and lands on from a bookmark; a `div` that navigates on click looks identical and does none
 * of it. It is also the reason the library's `Row` is not used here — its body is a `<button>`, for its
 * own good reasons, and a menu of places wants links.
 */
function DestinationCard({ item }: { item: NavigationItem }) {
  return (
    <NavLink
      to={item.path}
      className="group flex items-start gap-3 rounded-md border p-3.5 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:text-foreground">
        <item.icon className="size-4.5" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium">{item.label}</span>
        {item.description && <span className="text-xs leading-snug text-muted-foreground">{item.description}</span>}
      </span>
    </NavLink>
  )
}

/**
 * ⚠️ **Only ever drawn beside a heading**, which is why the caller guards it on `group.label`. The
 * count is the heading's other half — *does this group need anything* — and a bare "2 places" floating
 * over the one unlabelled group on a screen answers a question about a set the reader can already see
 * whole.
 */
function tallyOf(count: number): string {
  return count === 1 ? "1 place" : `${count} places`
}
