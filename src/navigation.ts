import {
  ArrowLeftRight,
  Bot,
  BookOpen,
  Boxes,
  Bug,
  FileCode,
  Building2,
  Home,
  KeyRound,
  Landmark,
  ListChecks,
  Mail,
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
 * The menu outside a workspace, and the screen that menu now leads to.
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
 * `LEGACY_SPACE_SECTIONS`, yet it is on the Administration rail. A screen here is a grouping of
 * destinations, never a route they have to live under.
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
          key: "exchange-rates",
          path: "/admin/exchange-rates",
          label: "Exchange rates",
          description: "What a currency is worth, and how old that answer is",
          icon: ArrowLeftRight,
          // ⚠️ `settings:read`, not a money permission of its own. The base currency is a system setting
          // behind `settings:write`, so a separate permission here would make an administrator who may
          // choose to total in dollars and may not sync the dollar rate that makes it work.
          requiredPermission: "settings:read",
          requiredEverywhere: true,
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

/**
 * ⚠️ **There was a second screen here — the Workbench — and it was removed rather than emptied.**
 *
 * It held the UI kit, the mapping builder and the validation documents under the sentence *"the tools
 * that describe the product itself"*. That sentence was written to stop the screen becoming a drawer,
 * and it did not: two of the three were a showcase and a screen opened once a year, and the third
 * already had a sidebar row of its own for the frequency reason below. A menu whose every entry is
 * reached faster another way is a level of navigation charging rent it does not earn.
 *
 * ⚠️ So `navigationScreens` is a list of one, deliberately — the mechanism is right and there is
 * currently one screen using it. A second is added by writing it, not by reviving this comment.
 */
export const navigationScreens: NavigationScreen[] = [ADMINISTRATION]

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
      /**
       * ⚠️ **A row here as well as a tile on the Workbench, and by the same rule as the audit log
       * above: frequency, not category.**
       *
       * It is configuration by any definition and belongs on the Workbench by category. But the rules a
       * record is judged by are edited while somebody is in the middle of building a form — they are
       * opened *during* work rather than once at setup, and reaching them meant leaving for the
       * Workbench and finding the tile.
       *
       * ⚠️ Its store is installation-wide — one document may judge many forms (`INVT-0299`) — which is
       * why it is here rather than in any workspace's own menu.
       */
      {
        key: "validation-documents",
        path: "/admin/validation",
        label: "Validation documents",
        icon: ShieldCheck,
        // The same permission the backend declares for the library's controllers: the listing names
        // every document in the installation.
        requiredPermission: "settings:write",
        requiredEverywhere: true,
        isBuilt: true,
      },
      /**
       * ⚠️ **Beside the validation documents, and directly below them on purpose.**
       *
       * The two answer adjacent questions about the same moment — *what is valid* and *what should
       * happen* — and somebody who has just written a rule refusing a quantity is the person about to
       * ask what should follow from one. Filing them apart would leave the second discoverable only to
       * whoever already knew it existed.
       *
       * ⚠️ Its store, unlike validation's, is **per workspace**: a script belongs to the workspace it
       * is written in, and switching workspace switches the documents. The permission is nevertheless
       * installation-wide, because a script is code that runs inside every entry write — see
       * `ScriptDocumentController` for why those two facts sit together.
       */
      {
        key: "scripts",
        path: "/admin/scripts",
        label: "Scripts",
        icon: FileCode,
        requiredPermission: "settings:write",
        requiredEverywhere: true,
        isBuilt: true,
      },
      screenRow(ADMINISTRATION),
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
