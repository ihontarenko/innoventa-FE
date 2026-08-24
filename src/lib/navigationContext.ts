import type { SpaceSummary } from "@/types"

/**
 * Which navigation context an address puts the shell in, and which workspace it names.
 *
 * ⚠️ **A pure function on purpose.** The sidebar, the switcher and the gate all need the same answer,
 * and each deriving its own is how they come to disagree — the address bar saying one workspace while
 * a request carries another.
 *
 * ⚠️ **The address is the source of truth for the active workspace. Nothing else is.** A store outlives
 * a navigation, so the first request after following a colleague's link would otherwise go out with
 * whichever workspace the previous screen left behind and quietly return the wrong data.
 */

export type NavigationContextKind = "platform" | "organization" | "space"

export const SPACE_ROUTE_ROOT = "/space"
export const ORGANIZATION_ROUTE_ROOT = "/organization"

/** Where the platform context starts — and where anything that cannot name a workspace lands. */
export const PLATFORM_HOME_PATH = "/hub"

/**
 * The first segment of every address the shell used before a workspace had one of its own.
 *
 * These redirect permanently, with no removal date: a redirect costs a line and bookmarks outlive
 * routers. ⚠️ `purposes` is deliberately absent — purposes are installation-wide, so `/purposes` is a
 * live platform address, and listing it here would forward the screen into whichever workspace
 * happened to be open last.
 */
export const LEGACY_SPACE_SECTIONS: readonly string[] = [
  "projects",
  "inventory",
  "catalog",
  "locations",
  "parametric-search",
  "entry",
  "component-types",
  "value-synonyms",
  "forms",
  "form-library",
  "results",
  "fields",
  "lookup",
  "pricing",
  "files",
  "tools",
  "search",
  "pages",
  "categories",
]

export interface ResolvedNavigationContext {
  kind: NavigationContextKind
  /**
   * The workspace this address names. ⚠️ Null everywhere outside the space context — deliberately
   * absent rather than "the last one", or the hub and the account screens would carry a workspace in
   * their headers while showing nothing that belongs to it.
   */
  space: SpaceSummary | null
  /** The slug the address named when the caller has no workspace answering to it. */
  unresolvedSpaceSlug: string | null
  organizationSlug: string | null
  /** Where this address should send the caller instead, for a legacy flat address. */
  redirectTo: string | null
}

function segmentsOf(pathname: string): string[] {
  return pathname.split("/").filter((segment) => segment.length > 0)
}

const PLATFORM_CONTEXT: ResolvedNavigationContext = {
  kind: "platform",
  space: null,
  unresolvedSpaceSlug: null,
  organizationSlug: null,
  redirectTo: null,
}

/** The address of a section inside a workspace — the one place that shape is written down. */
export function spaceSectionPath(spaceSlug: string, section = ""): string {
  const trimmed = section.replace(/^\/+/, "")

  return trimmed.length > 0 ? `${SPACE_ROUTE_ROOT}/${spaceSlug}/${trimmed}` : `${SPACE_ROUTE_ROOT}/${spaceSlug}`
}

/**
 * The section of a workspace address — everything after `/space/{slug}/`.
 *
 * The inverse of {@link spaceSectionPath}, and here beside it so the two cannot drift: taking the shape
 * apart by hand somewhere else is how a caller comes to depend on a layout this module owns.
 */
export function spaceSectionOf(pathname: string): string {
  return segmentsOf(pathname).slice(2).join("/")
}

export function resolveNavigationContext(input: {
  pathname: string
  search?: string
  spaces: SpaceSummary[]
  lastVisitedSpaceSlug: string | null
}): ResolvedNavigationContext {
  const { pathname, search = "", spaces, lastVisitedSpaceSlug } = input
  const [root, second] = segmentsOf(pathname)

  if (root === undefined) {
    return PLATFORM_CONTEXT
  }

  if (`/${root}` === SPACE_ROUTE_ROOT) {
    // A workspace root with nothing after it names no workspace, so it is treated as a flat address
    // rather than as an unresolvable one.
    if (second === undefined) {
      return { ...PLATFORM_CONTEXT, kind: "space", redirectTo: PLATFORM_HOME_PATH }
    }

    const space = spaces.find((candidate) => candidate.slug === second) ?? null

    return {
      kind: "space",
      space,
      unresolvedSpaceSlug: space ? null : second,
      organizationSlug: null,
      redirectTo: null,
    }
  }

  if (`/${root}` === ORGANIZATION_ROUTE_ROOT && second !== undefined) {
    return { ...PLATFORM_CONTEXT, kind: "organization", organizationSlug: second }
  }

  if (LEGACY_SPACE_SECTIONS.includes(root)) {
    return { ...PLATFORM_CONTEXT, redirectTo: legacyRedirectFor(pathname, search, spaces, lastVisitedSpaceSlug) }
  }

  return PLATFORM_CONTEXT
}

/**
 * A flat address, resolved against the workspace the caller was last in.
 *
 * ⚠️ The workspace is checked against their **own list** rather than trusted from the store: a
 * remembered slug can outlive the membership that made it reachable, and sending somebody to a "no such
 * workspace" screen for following their own bookmark is a worse answer than the hub.
 */
function legacyRedirectFor(
  pathname: string,
  search: string,
  spaces: SpaceSummary[],
  lastVisitedSpaceSlug: string | null,
): string {
  const lastVisited = lastVisitedSpaceSlug
    ? spaces.find((candidate) => candidate.slug === lastVisitedSpaceSlug)
    : undefined

  if (!lastVisited) {
    return PLATFORM_HOME_PATH
  }

  return `${spaceSectionPath(lastVisited.slug, pathname)}${search}`
}
