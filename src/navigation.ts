import {
  Bot,
  BookOpen,
  Boxes,
  Bug,
  Building2,
  Home,
  KeyRound,
  ListChecks,
  Mail,
  Palette,
  ScrollText,
  Settings,
  Share2,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react"

/**
 * The menu outside a workspace — and only that one.
 *
 * ⚠️ **Innoventa's navigation is three menus, not one.** The platform context is a list because
 * nothing gates it but permissions the token already carries; the *workspace* menu turns on which
 * modules that workspace presents and what its endpoints will answer, and neither is a fact the
 * browser holds — it is served. Porting that model belongs with the workspace screens
 * (`INVT-0055`), so the skeleton carries the platform context and says so, rather than inventing a
 * flat menu that would have to be unpicked later.
 */
/**
 * What an account must hold before a destination is offered to it — the whole of a gate, as data.
 *
 * ⚠️ **A type of its own so the reading of it can be written once.** These two fields were read in
 * three places by three copies of the same three lines — the sidebar, the personalisation tab, and
 * every screen that gated itself by re-typing the permission name. The copies agreed until they did
 * not: `assistant:use` is declared here, and the Assistant screen asked the *other* set for it, so the
 * screen worked and the menu row it belongs to did not exist. `authStore.holds` is now the only reader.
 */
export interface AccessRequirement {
  /**
   * Held **somewhere** or held **everywhere**? An installation-wide screen must ask the second
   * question: every ordinary account holds `space:read` in the workspaces it belongs to, so gating
   * "All workspaces" on the coarse set would show it to everybody.
   */
  requiredPermission?: string
  requiredEverywhere?: boolean
}

export interface NavigationItem extends AccessRequirement {
  /** Stable across renamings — what a personalisation preference records, never the path. */
  key: string
  path: string
  label: string
  icon: LucideIcon
  /** False until the domain ticket that owns this screen lands. The sidebar draws it as `soon`. */
  isBuilt?: boolean
  /** The ticket that brings the real screen. */
  portedBy?: string
}

export interface NavigationSection {
  key: string
  label: string
  items: NavigationItem[]
}

export const platformSections: NavigationSection[] = [
  {
    // "Personal" rather than "Home": both items are about *you*, which is what sets them apart from
    // Administration below, which is about everybody else.
    key: "platform-home",
    label: "Personal",
    items: [
      // "Hub", not "Home": the address is /hub and the first crumb says Hub. A product where the same
      // screen has two names is one the reader keeps translating.
      { key: "hub", path: "/hub", label: "Hub", icon: Home, portedBy: "INVT-0054", isBuilt: true },
      {
        key: "assistant",
        path: "/assistant",
        label: "Assistant",
        icon: Bot,
        requiredPermission: "assistant:use",
        // ⚠️ Installation-wide, because `assistant:use` is a GLOBAL permission and the screen behind
        // this row asks the installation-wide question. It used to be absent here, so the menu asked
        // "somewhere" and the screen asked "everywhere" — two answers to one question, and the day
        // they differed the Assistant was a working screen with no way to reach it.
        requiredEverywhere: true,
        portedBy: "INVT-0057",
        isBuilt: true,
      },
      { key: "account", path: "/settings", label: "Account", icon: Settings, portedBy: "INVT-0055", isBuilt: true },
    ],
  },
  {
    key: "administration",
    label: "Administration",
    items: [
      {
        key: "admin-users",
        path: "/admin",
        label: "Users",
        icon: Users,
        requiredPermission: "user:read",
        portedBy: "INVT-0055",
        isBuilt: true,
      },
      {
        key: "admin-access",
        path: "/admin/access",
        label: "Access control",
        icon: ShieldCheck,
        requiredPermission: "access:read",
        portedBy: "INVT-0055",
        // All twelve destinations: the three answers, the four whole-document readings, and the five
        // blocks the form edits.
        isBuilt: true,
      },
      {
        key: "admin-invitations",
        path: "/admin/invitations",
        label: "Invitations",
        icon: Mail,
        requiredPermission: "user:read",
        portedBy: "INVT-0055",
        isBuilt: true,
      },
      {
        key: "system-settings",
        path: "/admin/settings",
        label: "System settings",
        icon: KeyRound,
        requiredPermission: "settings:read",
        portedBy: "INVT-0055",
        isBuilt: true,
      },
      {
        key: "ai",
        path: "/admin/ai",
        label: "AI",
        icon: Bot,
        requiredPermission: "ai:read",
        portedBy: "INVT-0055",
        isBuilt: true,
      },
      {
        key: "sharing",
        path: "/admin/shares",
        label: "Sharing",
        icon: Share2,
        requiredPermission: "settings:write",
        portedBy: "INVT-0055",
        isBuilt: true,
      },
      {
        key: "admin-workspaces",
        path: "/admin/workspaces",
        label: "All workspaces",
        icon: Boxes,
        requiredPermission: "space:read",
        requiredEverywhere: true,
        portedBy: "INVT-0055",
        isBuilt: true,
      },
      {
        key: "admin-plans",
        path: "/admin/plans",
        label: "Plans",
        icon: Building2,
        requiredPermission: "plan:administer",
        portedBy: "INVT-0055",
        isBuilt: true,
      },
      {
        key: "purposes",
        path: "/purposes",
        label: "Purposes",
        icon: ListChecks,
        requiredPermission: "purpose:read",
        portedBy: "INVT-0053",
        isBuilt: true,
      },
      {
        key: "audit-log",
        path: "/audit",
        label: "Audit log",
        icon: ScrollText,
        requiredPermission: "audit:read",
        portedBy: "INVT-0055",
        isBuilt: true,
      },
      { key: "bug-reports", path: "/bug-report", label: "Bug reports", icon: Bug, portedBy: "INVT-0056", isBuilt: true },
      // ⚠️ **Not `INVT-0056`, and it waited on Kiwi rather than on anybody's time.** The manual is two
      // *category* trees, so it is a pages screen wearing a different name — and porting it before the
      // pages moved would have meant building the public category surface twice, once against each
      // store, weeks apart. It waited, and then landed whole: `/manual` and `/manual/:address` read
      // those trees out of Kiwi as a granted consumer, so the reader needs no token and no account.
      { key: "manual", path: "/manual", label: "Manual", icon: BookOpen, portedBy: "KW-13", isBuilt: true },
      // ⚠️ **No permission, deliberately.** The kit talks to nothing and discloses nothing — it is the
      // shared vocabulary for talking about this interface, and gating it would mean the person
      // describing a screen and the person building it could not name the same part.
      { key: "ui-kit", path: "/ui-kit", label: "jMouse UI", icon: Palette, isBuilt: true },
    ],
  },
]

/**
 * One platform entry, by key — for a screen that gates itself on the row that leads to it.
 *
 * ⚠️ **A screen that re-types its own permission can drift from its own menu row, and did.** The
 * Assistant named `assistant:use` twice, in two files, and chose a different one of the two sets each
 * time. Asking for the entry means there is one declaration and one reading of it, so the door and the
 * sign on it cannot disagree.
 *
 * ⚠️ **It throws on a key that is not there, rather than answering with nothing.** An entry that asks
 * for no permission is *open*, so an unknown key returning `undefined` would silently ungate whatever
 * screen mistyped it — the one failure mode this helper exists to remove.
 */
export function platformItem(key: string): NavigationItem {
  const found = platformSections.flatMap((section) => section.items).find((item) => item.key === key)

  if (!found) {
    throw new Error(`No platform navigation entry is keyed '${key}'.`)
  }

  return found
}

/**
 * ⚠️ **Pages are deliberately not here.** `/pages` is a workspace section, and the gate rewrites the flat
 * address into the workspace last visited (`LEGACY_SPACE_SECTIONS`). Listing it as a platform entry would
 * put a menu row above a route nothing ever reaches.
 */
export const navigationItems: NavigationItem[] = platformSections.flatMap((section) => section.items)
