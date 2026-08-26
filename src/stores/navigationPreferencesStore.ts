import { create } from "zustand"
import { persist } from "zustand/middleware"
import { authApi } from "@/api/auth"
import { navigationItems, platformSections } from "@/navigation"

/**
 * Navigation personalisation — server-persisted, and scoped to where each item lives.
 *
 * ⚠️ **Hiding a workspace item is a fact about that workspace.** It used to be one flat array across
 * the whole product, which is why an account screen ended up offering to hide Parametric search to
 * somebody whose only workspace counts nothing of the sort. The defence for that — hiding is a
 * preference across every workspace, so it must be configurable from outside one — was sound and the
 * conclusion was wrong: what follows is that workspace items are configured *inside* a workspace, not
 * that an account screen enumerates the product.
 *
 * So preferences are buckets keyed by scope: `platform` for everything reachable outside a workspace,
 * `space:{id}` for one workspace's own menu. Hiding Lookup in one workspace leaves it alone in the next.
 *
 * ⚠️ **Hidden items are recorded by item KEY, never by address.** Addresses are rewritten whenever the
 * shell is — putting the workspace in the URL rewrote every one of them — and a preference keyed by
 * address would silently empty itself the day that happens: nothing breaks, hidden items simply come
 * back, and nobody connects the two events.
 *
 * ⚠️ **The web-storage mirror is only for the first paint.** The source of truth is the account's
 * server-side preference, hydrated from `/auth/me` and written through on change — which is also what
 * makes a personalisation set in the old interface true in this one, since both read the same key.
 */

/** The key both interfaces read and write. ⚠️ Changing it silently un-hides everything, everywhere. */
const SCOPED_PREFERENCE_KEY = "navigation.hiddenItems"

/**
 * The shape before scopes: one flat array of item keys.
 *
 * ⚠️ **Read once and split, never written.** The shape before *that* was keyed by address and is
 * deliberately not carried here — translating it needs a table of two-shells-ago paths, and the old
 * interface has already migrated every account that ever had one. An account somehow still holding
 * only the address shape starts unpersonalised, which un-hides items rather than losing anything.
 */
const FLAT_PREFERENCE_KEY = "navigation.hiddenItemKeys"

/** Where a menu item lives, and therefore where hiding it is remembered. */
export const PLATFORM_SCOPE = "platform"

export function spaceScope(spaceId: string): string {
  return `space:${spaceId}`
}

export interface NavigationPreferences {
  /**
   * What a scope hides until it has been personalised itself. Carried over from the flat array this
   * replaced, and never written again — a scope that has been touched has a bucket.
   *
   * ⚠️ It is why a workspace never personalised and one personalised to hide nothing are different
   * things: the first has no bucket, the second has an empty one.
   */
  inherited: string[]
  scopes: Record<string, string[]>
}

interface NavigationPreferencesState {
  preferences: NavigationPreferences
  hydrated: boolean
  hydrateFromServer: (preferences: Record<string, string> | undefined) => void
  toggleItem: (scope: string, itemKey: string) => void
}

const EMPTY_PREFERENCES: NavigationPreferences = { inherited: [], scopes: {} }

/**
 * Every destination reachable outside a workspace — the sidebar's rows, both screens' entries and the
 * manual, read off the navigation rather than listed twice.
 *
 * ⚠️ **Deliberately the BROAD set, and only `splitFlatPreference` uses it.** Its job is telling a
 * platform key apart from a workspace one when the old flat array is carried across; a narrower set
 * would push `mapping-builder` and `ui-kit` into `inherited`, which is the default *every workspace*
 * starts from — one moved menu row would have hidden things in workspaces that never heard of it.
 */
const PLATFORM_ITEM_KEYS = new Set(navigationItems.map((item) => item.key))

/**
 * The keys the platform sidebar can actually draw — its rows, and nothing else.
 *
 * ⚠️ **Narrower than the set above, and the difference is the whole of this file's cleanup.** A
 * destination that stops being a sidebar row is no longer something a person can choose to hide, so a
 * preference naming it describes a row that does not exist. It hides nothing and breaks nothing; it
 * simply accumulates, and the day somebody debugs a menu they will find keys nothing renders.
 */
const PERSONALISABLE_PLATFORM_KEYS = new Set(
  platformSections.flatMap((section) => section.items).map((item) => item.key),
)

/**
 * The platform bucket, with keys no sidebar row answers to dropped — or the same object when there is
 * nothing to drop.
 *
 * ⚠️ **Identity is the signal**, so the caller can tell "already clean" from "cleaned" and write back
 * only in the second case. A save on every hydrate would be a request per sign-in that changes nothing.
 *
 * ⚠️ **The platform bucket ONLY.** A workspace's menu is served, so which keys it has is not a fact
 * this file holds — pruning one against a list the browser invented would delete a preference for a row
 * the server does draw.
 */
function withoutRetiredPlatformKeys(preferences: NavigationPreferences): NavigationPreferences {
  const bucket = preferences.scopes[PLATFORM_SCOPE]

  if (!bucket) {
    return preferences
  }

  const kept = bucket.filter((itemKey) => PERSONALISABLE_PLATFORM_KEYS.has(itemKey))

  if (kept.length === bucket.length) {
    return preferences
  }

  return { ...preferences, scopes: { ...preferences.scopes, [PLATFORM_SCOPE]: kept } }
}

/**
 * ⚠️ **Debounced, because a toggle is a click and a write is a request.** Somebody tidying their
 * sidebar flips six switches in three seconds; six requests would race, and the last one to land — not
 * the last one made — would win.
 */
let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave(preferences: NavigationPreferences) {
  if (saveTimer) {
    clearTimeout(saveTimer)
  }

  saveTimer = setTimeout(() => {
    // Swallowed: the mirror already holds it, so a failed write costs this account nothing until it
    // signs in elsewhere — and a toast per hidden menu item is worse than the risk.
    authApi.setPreference(SCOPED_PREFERENCE_KEY, JSON.stringify(preferences)).catch(() => undefined)
  }, 600)
}

function toStringArray(value: unknown): string[] | null {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : null
}

/**
 * The stored shape, defended against whatever is actually in the column.
 *
 * ⚠️ A preference is written by an older build of this same file as often as by the current one — and,
 * here, by a *different interface* — so a malformed bucket has to degrade to "not personalised" rather
 * than to a crash on first paint.
 */
export function parseNavigationPreferences(raw: string | undefined): NavigationPreferences | null {
  if (raw == null) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as { inherited?: unknown; scopes?: unknown }

    if (parsed == null || typeof parsed !== "object") {
      return null
    }

    const scopes =
      parsed.scopes && typeof parsed.scopes === "object"
        ? Object.fromEntries(
            Object.entries(parsed.scopes as Record<string, unknown>)
              .map(([scope, itemKeys]) => [scope, toStringArray(itemKeys)])
              .filter((entry): entry is [string, string[]] => entry[1] !== null),
          )
        : {}

    return { inherited: toStringArray(parsed.inherited) ?? [], scopes }
  } catch {
    return null
  }
}

/**
 * One flat array of hidden items, split along the seam that now exists.
 *
 * Items outside a workspace become the platform's bucket, because that is where they were configured
 * and where they still are. Everything else becomes the inherited default, so every workspace keeps
 * hiding what this account had already hidden — until somebody personalises that workspace, at which
 * point its own bucket takes over.
 */
export function splitFlatPreference(hiddenItemKeys: string[]): NavigationPreferences {
  return {
    inherited: hiddenItemKeys.filter((itemKey) => !PLATFORM_ITEM_KEYS.has(itemKey)),
    scopes: { [PLATFORM_SCOPE]: hiddenItemKeys.filter((itemKey) => PLATFORM_ITEM_KEYS.has(itemKey)) },
  }
}

/** What a scope hides: its own bucket, or the inherited default while it has never been touched. */
export function hiddenItemKeysIn(preferences: NavigationPreferences, scope: string): string[] {
  return preferences.scopes[scope] ?? preferences.inherited
}

export const useNavigationPreferencesStore = create<NavigationPreferencesState>()(
  persist(
    (set, get) => ({
      preferences: EMPTY_PREFERENCES,
      hydrated: false,

      hydrateFromServer: (serverPreferences) => {
        const scoped = parseNavigationPreferences(serverPreferences?.[SCOPED_PREFERENCE_KEY])

        if (scoped) {
          const pruned = withoutRetiredPlatformKeys(scoped)

          set({ preferences: pruned, hydrated: true })

          // Written back only when something was actually dropped, so this branch is taken once per
          // account and then never again.
          if (pruned !== scoped) {
            scheduleSave(pruned)
          }

          return
        }

        // No scoped preference yet, so whatever this account set up is still the flat array. Carry it
        // across and write it back in the new shape, so this branch is taken once and never again.
        const flat = (() => {
          try {
            return toStringArray(JSON.parse(serverPreferences?.[FLAT_PREFERENCE_KEY] ?? "null"))
          } catch {
            return null
          }
        })()

        if (flat) {
          // ⚠️ Split first, prune after — in that order. The split needs the BROAD platform set to tell
          // a platform key from a workspace one; pruning is about what the sidebar can draw, and asking
          // the narrow set first would file `ui-kit` under `inherited` and hide things in workspaces.
          const preferences = withoutRetiredPlatformKeys(splitFlatPreference(flat))

          set({ preferences, hydrated: true })
          scheduleSave(preferences)
          return
        }

        set({ hydrated: true })
      },

      toggleItem: (scope, itemKey) => {
        const { preferences } = get()
        const current = hiddenItemKeysIn(preferences, scope)

        const next: NavigationPreferences = {
          ...preferences,
          scopes: {
            ...preferences.scopes,
            [scope]: current.includes(itemKey)
              ? current.filter((hidden) => hidden !== itemKey)
              : [...current, itemKey],
          },
        }

        set({ preferences: next })
        scheduleSave(next)
      },
    }),
    {
      name: "innoventa.navigation-preferences",
      version: 3,
      partialize: (state) => ({ preferences: state.preferences }),
    },
  ),
)
