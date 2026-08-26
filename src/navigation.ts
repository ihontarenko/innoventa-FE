import {
  Bot,
  BookOpen,
  Boxes,
  Bug,
  Building2,
  Home,
  KeyRound,
  Landmark,
  ListChecks,
  Mail,
  Palette,
  PencilRuler,
  Route,
  ScrollText,
  Settings,
  Share2,
  ShieldCheck,
  Hammer,
  Smartphone,
  Users,
  type LucideIcon,
} from "lucide-react"

/**
 * The menu outside a workspace, and the two screens that menu now leads to.
 *
 * ⚠️ **Innoventa's navigation is three menus, not one.** The platform context is a list because
 * nothing gates it but permissions the token already carries; the *workspace* menu turns on which
 * modules that workspace presents and what its endpoints will answer, and neither is a fact the
 * browser holds — it is served.
 *
 * ⚠️ **The platform menu used to be TWO groups and seventeen rows**, the second of which was a flat
 * `Administration` list holding fifteen — four of which were not administration at all. What replaced
 * it is the shape Tessera and Kiwi already had: the administrative destinations moved onto a screen of
 * their own, and the sidebar kept only what somebody actually navigates by.
 *
 * The three lists below are all there is, and each has exactly one job:
 *
 * | | |
 * |---|---|
 * | `platformSections` | the sidebar, outside every workspace |
 * | `navigationScreens` | the two screens a sidebar row leads to, and the entries on each |
 * | `navigationItems` | every declared destination, flattened — for the router and for preferences |
 */

/**
 * What an account must hold before a destination is offered to it — the whole of a gate, as data.
 *
 * ⚠️ **A type of its own so the reading of it can be written once.** These fields were read in three
 * places by three copies of the same three lines — the sidebar, the personalisation tab, and every
 * screen that gated itself by re-typing the permission name. The copies agreed until they did not:
 * `assistant:use` is declared here, and the Assistant screen asked the *other* set for it, so the
 * screen worked and the menu row it belongs to did not exist. `authStore.holds` is now the only reader.
 */
export interface AccessRequirement {
  /**
   * Held **somewhere** or held **everywhere**? An installation-wide screen must ask the second
   * question: every ordinary account holds `space:read` in the workspaces it belongs to, so gating
   * "All workspaces" on the coarse set would show it to everybody.
   */
  requiredPermission?: string
  /**
   * ⚠️ **Not a judgement call — it is copied from the backend's own scope table.**
   * `Permissions.java` holds `Map.entry(USER_READ, AccessScope.GLOBAL)` and one line like it for every
   * permission in the product, and a controller may narrow or widen it with `scope =` on
   * `@RequiresAccess`. Whatever that says is what a request will actually be answered by, so it is what
   * a menu row must ask: a row gated on "somewhere" over a permission resolved at `GLOBAL` offers a
   * screen that then answers 403, which is the product lying about what it can do.
   */
  requiredEverywhere?: boolean
  /**
   * Held for **any one** of these — what a row leading to a whole screen asks.
   *
   * ⚠️ **Never hand-written.** `screenRow` derives it from the screen's own entries, so a row cannot
   * come to disagree with the screen behind it: adding an entry widens the row by construction, and
   * somebody holding only `plan:administer` is offered Administration and lands on Plans.
   */
  requiredAnyOf?: AccessRequirement[]
}

export interface NavigationItem extends AccessRequirement {
  /** Stable across renamings — what a personalisation preference records, never the path. */
  key: string
  path: string
  label: string
  /**
   * One line saying what is behind it, drawn on a screen's card and nowhere else.
   *
   * It echoes the destination's own page subtitle deliberately: a card that described a screen
   * differently from the screen's own header would be a second opinion about what it is for.
   */
  description?: string
  icon: LucideIcon
  /** False until the domain ticket that owns this screen lands. The sidebar draws it as `soon`. */
  isBuilt?: boolean
  /** The ticket that brings the real screen. */
  portedBy?: string
}

export interface NavigationSection {
  key: string
  /** Absent for a group that is the whole list — a heading over everything says nothing. */
  label?: string
  items: NavigationItem[]
}

/**
 * A destination that is itself a menu: a landing page of grouped cards, and a rail on every screen
 * reached from it.
 *
 * ⚠️ **The rail is on the SCREEN; the sidebar never changes.** An earlier attempt swapped the platform
 * menu out while the reader was inside one of these, the way entering a workspace does — Ivan's
 * correction was that a separate administration page is a page you go *to*, not a mode the whole
 * application enters.
 *
 * ⚠️ **Its entries keep their own addresses, and the screen imposes no prefix.** `Purposes` lives at
 * `/purposes` because purposes are installation-wide and the address was deliberately kept out of
 * `LEGACY_SPACE_SECTIONS`; the Mapping builder is at `/admin/mapping` though it belongs to the
 * Workbench. A screen here is a grouping of destinations, never a route they have to live under.
 */
export interface NavigationScreen {
  key: string
  path: string
  label: string
  description: string
  icon: LucideIcon
  groups: NavigationSection[]
}

const ADMINISTRATION: NavigationScreen = {
  key: "administration",
  path: "/admin",
  label: "Administration",
  description: "Everything the installation decides — its people, its access, and what it runs on",
  icon: Landmark,
  groups: [
    {
      key: "people",
      label: "People",
      items: [
        {
          key: "admin-users",
          path: "/admin/users",
          label: "Users",
          description: "Accounts, roles and the permission catalogue",
          icon: Users,
          requiredPermission: "user:read",
          requiredEverywhere: true,
          portedBy: "INVT-0055",
          isBuilt: true,
        },
        {
          key: "admin-invitations",
          path: "/admin/invitations",
          label: "Invitations",
          description: "Codes that let somebody become an account here",
          icon: Mail,
          requiredPermission: "user:read",
          requiredEverywhere: true,
          portedBy: "INVT-0055",
          isBuilt: true,
        },
        {
          key: "crafts",
          path: "/admin/crafts",
          label: "Crafts",
          description: "What people here do — which decides what they are shown first, never what they may open",
          icon: Hammer,
          requiredPermission: "user:write",
          requiredEverywhere: true,
          isBuilt: true,
        },
      ],
    },
    {
      // ⚠️ **A group of its own, and `Crafts` is deliberately not in it.** A craft is a job, not a
      // permission, and filing the two together is the first step towards somebody administering one as
      // the other. The flat menu this screen replaced kept them apart for that reason and said so; a
      // regrouping that put them side by side would quietly undo it.
      key: "access",
      label: "Access",
      items: [
        {
          key: "admin-access",
          path: "/admin/access",
          label: "Access control",
          description: "Why one person may do one thing — and the document that decides it",
          icon: ShieldCheck,
          requiredPermission: "access:read",
          requiredEverywhere: true,
          portedBy: "INVT-0055",
          isBuilt: true,
        },
      ],
    },
    {
      key: "installation",
      label: "Installation",
      items: [
        {
          key: "system-settings",
          path: "/admin/settings",
          label: "System settings",
          description: "Runtime configuration for the whole installation",
          icon: KeyRound,
          requiredPermission: "settings:read",
          requiredEverywhere: true,
          portedBy: "INVT-0055",
          isBuilt: true,
        },
        {
          key: "ai",
          path: "/admin/ai",
          label: "AI",
          description: "The assistant, the tools it holds, and what they have cost",
          icon: Bot,
          requiredPermission: "ai:read",
          requiredEverywhere: true,
          portedBy: "INVT-0055",
          isBuilt: true,
        },
        {
          key: "sharing",
          path: "/admin/shares",
          label: "Sharing",
          description: "Everything published, and how it is reached",
          icon: Share2,
          requiredPermission: "settings:write",
          requiredEverywhere: true,
          portedBy: "INVT-0055",
          isBuilt: true,
        },
      ],
    },
    {
      key: "tenancy",
      label: "Tenancy",
      items: [
        {
          key: "admin-workspaces",
          path: "/admin/workspaces",
          label: "All workspaces",
          description: "Every workspace in the installation, and what it holds",
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
          description: "What each tier includes, and which account is on it",
          icon: Building2,
          requiredPermission: "plan:administer",
          requiredEverywhere: true,
          portedBy: "INVT-0055",
          isBuilt: true,
        },
        {
          // ⚠️ `/purposes`, not `/admin/purposes`. Purposes are installation-wide, and the address is
          // the one flat entry deliberately kept out of `LEGACY_SPACE_SECTIONS` so it is never
          // rewritten into whichever workspace was open last. Being on this screen does not move it.
          key: "purposes",
          path: "/purposes",
          label: "Purposes",
          description: "What a form is for, and the headings its forms are filed under",
          icon: ListChecks,
          requiredPermission: "purpose:read",
          portedBy: "INVT-0053",
          isBuilt: true,
        },
      ],
    },
  ],
}

const WORKBENCH: NavigationScreen = {
  key: "workbench",
  path: "/workbench",
  label: "Workbench",
  // The sentence anything proposed for this screen has to answer to — without it the Workbench becomes
  // the drawer everything that fits nowhere else ends up in.
  description: "The tools that describe the product itself, rather than the data an installation holds",
  // ⚠️ **Not `Wrench`, for the same reason it is not called Tools:** that icon and that word already
  // name a *workspace* section, and one name resolving to two places depending on which navigation
  // context is open is how a product acquires a vocabulary nobody can use out loud.
  icon: PencilRuler,
  groups: [
    {
      key: "workbench-tools",
      items: [
        {
          // ⚠️ **No permission, deliberately.** The kit discloses nothing — it is the shared vocabulary
          // for talking about this interface, and gating it would mean the person describing a screen
          // and the person building it could not name the same part.
          key: "ui-kit",
          path: "/ui-kit",
          label: "jMouse UI",
          description: "Every part this interface is built from — what we call it, and where it comes from",
          icon: Palette,
          isBuilt: true,
        },
        {
          key: "mapping-builder",
          path: "/admin/mapping",
          label: "Mapping builder",
          description: "Compose a .jmm document from a form, and read back what the server makes of it",
          icon: Route,
          // ⚠️ `settings:write` rather than a read permission, and it matches what the backend declares
          // for the library's controller. The catalogue behind this screen is every class name and every
          // property in the installation — a description of the product's shape, not read-level data.
          requiredPermission: "settings:write",
          requiredEverywhere: true,
          isBuilt: true,
        },
      ],
    },
  ],
}

export const navigationScreens: NavigationScreen[] = [ADMINISTRATION, WORKBENCH]

export function screenItems(screen: NavigationScreen): NavigationItem[] {
  return screen.groups.flatMap((group) => group.items)
}

/**
 * The sidebar row that leads to a screen — **derived, never written out.**
 *
 * ⚠️ **Including its gate.** A row hand-gated on one permission drifts from the screen behind it the
 * first time an entry is added; asking for *any* of the screen's own requirements cannot. A screen
 * every one of whose entries is refused offers no row at all, which is the honest answer — and one with
 * an ungated entry (the UI kit) is open, because it genuinely is.
 */
function screenRow(screen: NavigationScreen): NavigationItem {
  return {
    key: screen.key,
    path: screen.path,
    label: screen.label,
    description: screen.description,
    icon: screen.icon,
    isBuilt: true,
    requiredAnyOf: screenItems(screen).map(({ requiredPermission, requiredEverywhere }) => ({
      requiredPermission,
      requiredEverywhere,
    })),
  }
}

export const platformSections: NavigationSection[] = [
  {
    // "Personal" rather than "Home": every item is about *you*, which is what sets them apart from
    // Installation below, which is about everybody else.
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
      // ⚠️ **No permission, deliberately.** The shelf discloses nothing: every tile on it has already
      // been decided by the backend against this account's own permissions and its workspaces' own
      // modules. A gate here would be a second opinion about a decision already taken, and somebody
      // holding nothing still deserves the screen that tells them so.
      { key: "stations", path: "/stations", label: "Stations", icon: Smartphone, isBuilt: true },
      // ⚠️ **Personal, not administration, and singular.** It is an embed of Innoventa's own public
      // bug-report form: a thing you *submit*, which is what puts it beside the hub rather than on the
      // Administration screen. The plural read as "everybody's reports", which is not a screen we have.
      { key: "bug-reports", path: "/bug-report", label: "Bug report", icon: Bug, portedBy: "INVT-0056", isBuilt: true },
      { key: "account", path: "/settings", label: "Account", icon: Settings, portedBy: "INVT-0055", isBuilt: true },
    ],
  },
  {
    key: "platform-installation",
    label: "Installation",
    items: [
      // ⚠️ **A row rather than an entry on the Administration screen, and the rule is FREQUENCY, not
      // category.** The audit log is administration by any definition; it stays in the sidebar because
      // it is opened daily while everything on that screen is configured once. Written down because the
      // next reader will otherwise, quite logically, move it to where it belongs.
      {
        key: "audit-log",
        path: "/audit",
        label: "Audit log",
        icon: ScrollText,
        requiredPermission: "audit:read",
        requiredEverywhere: true,
        portedBy: "INVT-0055",
        isBuilt: true,
      },
      screenRow(ADMINISTRATION),
      screenRow(WORKBENCH),
    ],
  },
]

/**
 * The manual — the sidebar's footer, beside the theme and the account, and not in any group.
 *
 * ⚠️ **No permission, and not because nobody thought about it.** It is anonymous public reading served
 * out of Kiwi through this backend as a granted consumer; a reader needs neither a token nor an account.
 * That makes it help rather than a destination, and help belongs with the rest of the chrome.
 */
export const MANUAL_ITEM: NavigationItem = {
  key: "manual",
  path: "/manual",
  label: "Manual",
  icon: BookOpen,
  portedBy: "KW-13",
  isBuilt: true,
}

/**
 * Every destination this file declares — the sidebar's rows, both screens' entries, and the manual.
 *
 * It is what the router builds stubs from and what navigation preferences count as a platform key, so
 * a destination that moved from the sidebar onto a screen is still recognised as one somebody may have
 * personalised.
 *
 * ⚠️ **Pages are deliberately not here.** `/pages` is a workspace section, and the gate rewrites the
 * flat address into the workspace last visited (`LEGACY_SPACE_SECTIONS`). Listing it as a platform
 * entry would put a menu row above a route nothing ever reaches.
 */
export const navigationItems: NavigationItem[] = [
  ...platformSections.flatMap((section) => section.items),
  ...navigationScreens.flatMap(screenItems),
  MANUAL_ITEM,
]

/**
 * One declared destination, by key — for a screen that gates itself on the entry that leads to it.
 *
 * ⚠️ **A screen that re-types its own permission can drift from its own menu row, and did.** The
 * Assistant named `assistant:use` twice, in two files, and chose a different one of the two sets each
 * time. Asking for the entry means there is one declaration and one reading of it, so the door and the
 * sign on it cannot disagree.
 *
 * ⚠️ **It looks on the screens as well as in the sidebar.** A destination that stopped being a sidebar
 * row when the Administration screen was built did not stop being gated, and a lookup that only knew
 * about the sidebar would have started throwing for every one of them.
 *
 * ⚠️ **It throws on a key that is not there, rather than answering with nothing.** An entry that asks
 * for no permission is *open*, so an unknown key returning `undefined` would silently ungate whatever
 * screen mistyped it — the one failure mode this helper exists to remove.
 */
export function platformItem(key: string): NavigationItem {
  const found = navigationItems.find((item) => item.key === key)

  if (!found) {
    throw new Error(`No navigation entry is keyed '${key}'.`)
  }

  return found
}

/**
 * The permission names a gate mentions — for a refusal that names them rather than shrugging.
 *
 * ⚠️ **So `AccessDenied` stops being the last place a permission string is typed by hand.** A screen
 * that asks the declaration whether to refuse, and then writes `permissions={["user:read"]}` under it,
 * has re-created exactly the drift it just avoided — one line lower down, where it is refused *and*
 * mis-named.
 */
export function requiredPermissionsOf(requirement: AccessRequirement): string[] {
  if (requirement.requiredAnyOf) {
    return [...new Set(requirement.requiredAnyOf.flatMap(requiredPermissionsOf))]
  }

  return requirement.requiredPermission ? [requirement.requiredPermission] : []
}

/**
 * One screen, by key — for the layout that draws its rail.
 *
 * ⚠️ **It throws on an unknown key rather than answering with nothing**, for `platformItem`'s reason:
 * a layout handed `undefined` would render an empty rail beside a working screen, which reads as a
 * product with a missing menu rather than as a typo.
 */
export function navigationScreen(key: string): NavigationScreen {
  const found = navigationScreens.find((screen) => screen.key === key)

  if (!found) {
    throw new Error(`No navigation screen is keyed '${key}'.`)
  }

  return found
}
