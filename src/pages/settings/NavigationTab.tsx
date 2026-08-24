import { Row, RowGroup, RowList, RowMeta, RowTitle, Switch } from "@jmouse/ui"
import { platformSections } from "@/navigation"
import { useAuthStore } from "@/stores/authStore"
import { hiddenItemKeysIn, PLATFORM_SCOPE, useNavigationPreferencesStore } from "@/stores/navigationPreferencesStore"

/**
 * The two items that are never hideable: the hub is where every context is reachable from, and Account
 * is the way back into these very settings.
 */
const ALWAYS_VISIBLE_ITEM_KEYS = new Set(["hub", "account"])

/**
 * Which items *you* see outside a workspace.
 *
 * ⚠️ **This screen lists what lives OUTSIDE every workspace, and nothing else.** It used to list all
 * three contexts at once, which meant an account screen offering to hide Parametric search to somebody
 * whose only workspace counts nothing of the sort. Its own comment defended that — hiding is a
 * preference across every workspace, so it has to be configurable from outside one — and the premise was
 * right while the conclusion was wrong: what follows is that workspace items are configured *inside* a
 * workspace, from the menu it actually serves.
 *
 * ⚠️ **Subtractive, and yours alone.** Nothing here grants or refuses anything; a hidden item is still
 * reachable by address and still answers. What it changes is one sidebar — this one.
 */
export function NavigationTab() {
  /**
   * Only the permission gate applies here — an item this account was never offered is not one it can
   * choose to hide, and offering it would record a preference that comes back the day the grant does.
   *
   * ⚠️ The store's reading of the item's own declaration, the same one the sidebar uses. A copy here
   * would be a second opinion about which menu this account has, kept in the screen for editing it.
   */
  const mayOpen = useAuthStore((state) => state.holds)

  const preferences = useNavigationPreferencesStore((state) => state.preferences)
  const toggleItem = useNavigationPreferencesStore((state) => state.toggleItem)

  const hidden = hiddenItemKeysIn(preferences, PLATFORM_SCOPE)

  const groups = platformSections
    .map((section) => ({
      ...section,
      items: section.items.filter(mayOpen).filter((item) => !ALWAYS_VISIBLE_ITEM_KEYS.has(item.key)),
    }))
    .filter((section) => section.items.length > 0)

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <h2 className="text-sm font-medium">Navigation</h2>
        <p className="text-xs text-muted-foreground">
          Show or hide the items you see outside a workspace. Hub and Account are always visible. A workspace's own menu
          is personalised inside that workspace, under Workspace settings — so hiding something there leaves it alone
          everywhere else.
        </p>
      </div>

      {groups.map((section) => {
        const shown = section.items.filter((item) => !hidden.includes(item.key)).length

        return (
          <RowGroup key={section.key} label={section.label} tally={`${shown} of ${section.items.length} shown`}>
            <RowList variant="carded">
              {section.items.map((item) => (
                <Row
                  key={item.key}
                  variant="carded"
                  leading={<item.icon className="size-4" />}
                  trailing={
                    <Switch
                      checked={!hidden.includes(item.key)}
                      onCheckedChange={() => toggleItem(PLATFORM_SCOPE, item.key)}
                    />
                  }
                >
                  <RowTitle>{item.label}</RowTitle>
                  <RowMeta>{item.path}</RowMeta>
                </Row>
              ))}
            </RowList>
          </RowGroup>
        )
      })}
    </div>
  )
}
